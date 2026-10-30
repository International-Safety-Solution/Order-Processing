import { query } from '@/lib/db';
import { getSession, setSession } from '@/lib/auth';
import { hashPassword } from '@/lib/passwordUtils';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function PUT(request, context) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await context.params;
  const staffId = parseInt(id);

  try {
    const { name, email, password, role = 'STAFF', designation, permissionScopes } = await request.json();

    if (!name || !email) {
      return Response.json({ error: 'Name and email are required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return Response.json({ error: 'Please enter a valid email address (e.g. user@company.com)' }, { status: 400 });
    }

    const userRole = role === 'ADMIN' ? 'ADMIN' : 'STAFF';
    let userDesignation = designation;

    if (userRole === 'ADMIN') {
      userDesignation = null;
    } else {
      const validDesignations = ['TASK_COMPLETION', 'INVOICE_CREATION', 'INVOICE_COURIER'];
      if (!validDesignations.includes(designation)) {
        return Response.json({ error: 'Invalid designation selection for staff member' }, { status: 400 });
      }
    }

    // Check if email belongs to someone else
    const existing = await query('SELECT id FROM users WHERE email = ? AND id != ?', [cleanEmail, staffId]);
    if (existing && existing.length > 0) {
      return Response.json({ error: 'Another user already has this email' }, { status: 400 });
    }

    if (password && password.trim() !== '') {
      // Update with new password and force password change on next login for staff
      const mustChange = userRole === 'STAFF' ? 1 : 0;
      const hashedPassword = hashPassword(password.trim());
      await query(
        'UPDATE users SET name = ?, email = ?, password = ?, role = ?, designation = ?, permission_scopes = ?, must_change_password = ? WHERE id = ?',
        [name, email, hashedPassword, userRole, userDesignation, permissionScopes || null, mustChange, staffId]
      );
    } else {
      // Update without changing password
      await query(
        'UPDATE users SET name = ?, email = ?, role = ?, designation = ?, permission_scopes = ? WHERE id = ?',
        [name, email, userRole, userDesignation, permissionScopes || null, staffId]
      );
    }

    // If updating own logged-in account, refresh active session cookie instantly
    if (session && session.id === staffId) {
      await setSession({
        ...session,
        name,
        email,
        role: userRole,
        designation: userDesignation,
        permission_scopes: permissionScopes || null
      });
    }

    return Response.json({
      success: true,
      message: 'Account updated successfully'
    });
  } catch (error) {
    console.error('Update staff error:', error);
    return Response.json({ error: 'Failed to update account' }, { status: 500 });
  }
}

export async function DELETE(request, context) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await context.params;
  const staffId = parseInt(id);

  // Prevent deleting oneself
  if (session.id === staffId) {
    return Response.json({ error: 'You cannot delete your own account' }, { status: 400 });
  }

  try {
    // Foreign key safety pre-check: ensure user is not referenced in orders
    const assignedOrders = await query(
      'SELECT id FROM orders WHERE assigned_staff_1_id = ? OR assigned_staff_2_id = ? OR assigned_staff_3_id = ? OR created_by_id = ? LIMIT 1',
      [staffId, staffId, staffId, staffId]
    );

    if (assignedOrders && assignedOrders.length > 0) {
      return Response.json({
        error: 'Cannot delete staff member: This account is assigned to or created orders. Please reassign those orders before deleting.'
      }, { status: 400 });
    }

    // Delete user
    await query('DELETE FROM users WHERE id = ?', [staffId]);
    return Response.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete staff error:', error);
    return Response.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
