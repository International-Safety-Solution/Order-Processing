import { query } from '@/lib/db';
import { getSession, getUserPermissions } from '@/lib/auth';
import { sendSystemEmail } from '@/lib/mailer';
import { hashPassword } from '@/lib/passwordUtils';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const session = await getSession();
  const permissions = await getUserPermissions(session);
  
  if (!session || (session.role !== 'ADMIN' && !permissions?.order_processing?.view && !permissions?.order_processing?.create && !permissions?.order_processing?.edit)) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const staff = await query("SELECT id, email, name, role, designation, permission_scopes, must_change_password FROM users ORDER BY id ASC");
    return Response.json(staff);
  } catch (error) {
    console.error('Fetch staff error:', error);
    return Response.json({ error: 'Database query failed' }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { name, email, password, role = 'STAFF', designation, permissionScopes } = await request.json();

    const plainPassword = (password && password.trim()) ? password.trim() : '12345678';
    const cleanEmail = email.trim().toLowerCase();

    if (!name || !cleanEmail) {
      return Response.json({ error: 'Name and email are required' }, { status: 400 });
    }

    if (!EMAIL_REGEX.test(cleanEmail)) {
      return Response.json({ error: 'Please enter a valid email address (e.g. user@company.com)' }, { status: 400 });
    }

    const userRole = role === 'ADMIN' ? 'ADMIN' : 'STAFF';
    let userDesignation = designation;
    const mustChangePassword = userRole === 'STAFF' ? 1 : 0;

    if (userRole === 'ADMIN') {
      userDesignation = null;
    } else {
      const validDesignations = ['TASK_COMPLETION', 'INVOICE_CREATION', 'INVOICE_COURIER'];
      if (!validDesignations.includes(designation)) {
        return Response.json({ error: 'Invalid designation selection for staff member' }, { status: 400 });
      }
    }

    // Check if user already exists
    const existing = await query('SELECT id FROM users WHERE LOWER(email) = ?', [cleanEmail]);
    if (existing && existing.length > 0) {
      return Response.json({ error: 'Account with this email already exists' }, { status: 400 });
    }

    const hashedPassword = hashPassword(plainPassword);

    // Insert user with secure hash
    const result = await query(
      'INSERT INTO users (email, password, name, role, designation, permission_scopes, must_change_password) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [cleanEmail, hashedPassword, name, userRole, userDesignation, permissionScopes || null, mustChangePassword]
    );

    // Send email notification to new staff member
    if (userRole === 'STAFF') {
      const portalUrl = process.env.FRONTEND_URL 
        ? (process.env.FRONTEND_URL.startsWith('http') ? process.env.FRONTEND_URL : `https://${process.env.FRONTEND_URL}`)
        : 'https://order.internationalsafetysolution.com';

      sendSystemEmail('staff_registered', {
        direct_recipient: cleanEmail,
        user_name: name,
        user_email: cleanEmail,
        temp_password: plainPassword,
        portal_url: portalUrl
      }).catch(e => console.error('Failed to dispatch staff registration email:', e));
    }

    return Response.json({
      success: true,
      message: 'Account created successfully and registration email dispatched',
      staffId: result.insertId
    });
  } catch (error) {
    console.error('Create staff error:', error);
    return Response.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
