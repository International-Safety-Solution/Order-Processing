import { query } from './db';
import { cookies } from 'next/headers';
import crypto from 'crypto';

const SESSION_COOKIE_NAME = 'company_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'iss_portal_session_hmac_secret_2026_secured_key';

function signSession(payloadBase64) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(payloadBase64).digest('hex');
}

function verifySessionSignature(payloadBase64, signatureHex) {
  if (!payloadBase64 || !signatureHex) return false;
  try {
    const expectedSig = signSession(payloadBase64);
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    const actualBuf = Buffer.from(signatureHex, 'hex');
    if (expectedBuf.length !== actualBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  } catch (err) {
    return false;
  }
}

export async function setSession(user) {
  const cookieStore = await cookies();
  const sessionData = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    designation: user.designation,
    permission_scopes: user.permission_scopes || null,
    must_change_password: !!user.must_change_password,
    loginTime: new Date().toISOString()
  };
  
  const payloadBase64 = Buffer.from(JSON.stringify(sessionData)).toString('base64');
  const signature = signSession(payloadBase64);
  const signedToken = `${payloadBase64}.${signature}`;
  
  cookieStore.set(SESSION_COOKIE_NAME, signedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: '/'
  });
}

export async function getSession() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME);
  
  if (!cookie || !cookie.value) {
    return null;
  }
  
  try {
    const parts = cookie.value.split('.');
    if (parts.length === 2) {
      const [payloadBase64, signature] = parts;
      if (!verifySessionSignature(payloadBase64, signature)) {
        console.warn('Session signature mismatch detected. Possible tampering attempt blocked.');
        return null;
      }
      const decoded = Buffer.from(payloadBase64, 'base64').toString('utf8');
      return JSON.parse(decoded);
    } else {
      // Graceful migration fallback for legacy unsigned active sessions
      const decoded = Buffer.from(cookie.value, 'base64').toString('utf8');
      return JSON.parse(decoded);
    }
  } catch (error) {
    console.error('Failed to parse session cookie:', error);
    return null;
  }
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getUserPermissions(user) {
  if (!user) return null;
  if (user.role === 'ADMIN') {
    // Admin has full permissions
    return {
      order_processing: { view: true, create: true, edit: true, delete: true },
      order_types: { view: true, create: true, edit: true, delete: true },
      client_management: { view: true, create: true, edit: true, delete: true },
      phases: { production: true, accounts: true, logistics: true }
    };
  }

  // Query fresh user details from database to avoid cached scopeIds from outdated session cookies
  let dbUser = null;
  try {
    if (process.env.DB_HOST) {
      const users = await query('SELECT designation, permission_scopes, must_change_password FROM users WHERE id = ?', [user.id]);
      if (users.length > 0) dbUser = users[0];
    } else {
      const users = await query('SELECT * FROM users');
      dbUser = users.find(u => u.id === user.id);
    }
  } catch (e) {
    console.error('Failed to fetch fresh user for permissions:', e);
  }

  const activeUser = dbUser || user;
  const scopeIdsStr = activeUser.permission_scopes;
  if (!scopeIdsStr) {
    // If no scopes are assigned, fallback to designation mapping
    const des = activeUser.designation;
    return {
      order_processing: { view: true, create: false, edit: false, delete: false },
      order_types: { view: false, create: false, edit: false, delete: false },
      client_management: { view: false, create: false, edit: false, delete: false },
      phases: {
        production: des === 'TASK_COMPLETION',
        accounts: des === 'INVOICE_CREATION',
        logistics: des === 'INVOICE_COURIER'
      }
    };
  }

  const scopeIds = scopeIdsStr.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
  if (scopeIds.length === 0) {
    return {
      order_processing: { view: false, create: false, edit: false, delete: false },
      order_types: { view: false, create: false, edit: false, delete: false },
      client_management: { view: false, create: false, edit: false, delete: false },
      phases: { production: false, accounts: false, logistics: false }
    };
  }

  try {
    let scopes;
    if (process.env.DB_HOST) {
      scopes = await query('SELECT * FROM permission_scopes WHERE id IN (' + scopeIds.join(',') + ')');
    } else {
      scopes = await query('SELECT * FROM permission_scopes');
      scopes = scopes.filter(s => scopeIds.includes(s.id));
    }

    // Merge permissions
    const merged = {
      order_processing: { view: false, create: false, edit: false, delete: false },
      order_types: { view: false, create: false, edit: false, delete: false },
      client_management: { view: false, create: false, edit: false, delete: false },
      phases: { production: false, accounts: false, logistics: false }
    };

    scopes.forEach(scope => {
      let perms = scope.permissions;
      if (typeof perms === 'string') {
        try {
          perms = JSON.parse(perms);
        } catch (e) {
          perms = {};
        }
      }
      
      if (perms.order_processing) {
        merged.order_processing.view = merged.order_processing.view || !!perms.order_processing.view;
        merged.order_processing.create = merged.order_processing.create || !!perms.order_processing.create;
        merged.order_processing.edit = merged.order_processing.edit || !!perms.order_processing.edit;
        merged.order_processing.delete = merged.order_processing.delete || !!perms.order_processing.delete;
      }
      if (perms.order_types) {
        merged.order_types.view = merged.order_types.view || !!perms.order_types.view;
        merged.order_types.create = merged.order_types.create || !!perms.order_types.create;
        merged.order_types.edit = merged.order_types.edit || !!perms.order_types.edit;
        merged.order_types.delete = merged.order_types.delete || !!perms.order_types.delete;
      }
      if (perms.client_management) {
        merged.client_management.view = merged.client_management.view || !!perms.client_management.view;
        merged.client_management.create = merged.client_management.create || !!perms.client_management.create;
        merged.client_management.edit = merged.client_management.edit || !!perms.client_management.edit;
        merged.client_management.delete = merged.client_management.delete || !!perms.client_management.delete;
      }
      if (perms.phases) {
        merged.phases.production = merged.phases.production || !!perms.phases.production;
        merged.phases.accounts = merged.phases.accounts || !!perms.phases.accounts;
        merged.phases.logistics = merged.phases.logistics || !!perms.phases.logistics;
      }
    });

    return merged;
  } catch (error) {
    console.error('Failed to get user permissions:', error);
    return null;
  }
}
