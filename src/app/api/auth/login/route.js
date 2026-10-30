import { query } from '@/lib/db';
import { setSession } from '@/lib/auth';
import { verifyPassword, hashPassword, needsRehash } from '@/lib/passwordUtils';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return Response.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    let users = await query('SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);
    if (!users || users.length === 0) {
      const allUsers = await query('SELECT * FROM users');
      if (Array.isArray(allUsers)) {
        users = allUsers.filter(u => u.email && u.email.trim().toLowerCase() === cleanEmail);
      }
    }
    
    if (!users || users.length === 0) {
      return Response.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const user = users[0];

    // Password comparison using secure scrypt verification
    const passwordMatches = verifyPassword(cleanPassword, user.password);

    if (!passwordMatches) {
      return Response.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Auto-upgrade plain text password to secure scrypt hash in database
    if (needsRehash(user.password)) {
      try {
        const secureHash = hashPassword(cleanPassword);
        await query('UPDATE users SET password = ? WHERE id = ?', [secureHash, user.id]);
      } catch (err) {
        console.error('Failed to auto-upgrade user password hash:', err);
      }
    }

    // Set session
    await setSession(user);

    return Response.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        designation: user.designation,
        must_change_password: !!user.must_change_password
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
