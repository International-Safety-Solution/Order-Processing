import { query } from '@/lib/db';
import { getSession, setSession } from '@/lib/auth';
import { hashPassword } from '@/lib/passwordUtils';

export async function PUT(request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.id;

  try {
    const { name, email, password } = await request.json();

    if (!name || !email) {
      return Response.json({ error: 'Name and email are required' }, { status: 400 });
    }

    // Check if email belongs to someone else
    const existing = await query('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
    if (existing && existing.length > 0) {
      return Response.json({ error: 'Another user already has this email' }, { status: 400 });
    }

    if (password && password.trim() !== '') {
      const hashedPassword = hashPassword(password.trim());
      await query(
        'UPDATE users SET name = ?, email = ?, password = ?, designation = ? WHERE id = ?',
        [name, email, hashedPassword, session.designation, userId]
      );
    } else {
      await query(
        'UPDATE users SET name = ?, email = ?, designation = ? WHERE id = ?',
        [name, email, session.designation, userId]
      );
    }

    // Refresh session cookie with updated name/email so sidebar reflects new data on reload
    await setSession({
      ...session,
      name,
      email
    });

    return Response.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile API error:', error);
    return Response.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
