import { query } from '@/lib/db';
import { getSession, setSession } from '@/lib/auth';
import { verifyPassword, hashPassword } from '@/lib/passwordUtils';

export async function POST(request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { currentPassword, newPassword, confirmPassword } = await request.json();

    if (!currentPassword || !newPassword || !confirmPassword) {
      return Response.json({ error: 'All password fields are required' }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return Response.json({ error: 'New password and confirm password do not match' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return Response.json({ error: 'New password must be at least 6 characters long' }, { status: 400 });
    }

    // Verify current password against database
    const users = await query('SELECT * FROM users WHERE id = ?', [session.id]);
    if (!users || users.length === 0) {
      return Response.json({ error: 'User account not found' }, { status: 404 });
    }

    const user = users[0];
    const passwordValid = verifyPassword(currentPassword.trim(), user.password);

    if (!passwordValid) {
      return Response.json({ error: 'Current default password is incorrect' }, { status: 400 });
    }

    const hashedPassword = hashPassword(newPassword.trim());

    // Update password and set must_change_password = 0
    await query(
      'UPDATE users SET password = ?, must_change_password = 0 WHERE id = ?',
      [hashedPassword, session.id]
    );

    // Refresh session cookie with must_change_password = false
    await setSession({
      ...session,
      must_change_password: false
    });

    return Response.json({
      success: true,
      message: 'Password updated successfully! Account activated.'
    });
  } catch (error) {
    console.error('Change password error:', error);
    return Response.json({ error: 'Failed to update password' }, { status: 500 });
  }
}
