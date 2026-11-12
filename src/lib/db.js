import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

const MOCK_DB_PATH = path.join(process.cwd(), 'src/lib/mockDb.json');

// Initial seed data for fallback database
const initialMockData = {
  users: [
    {
      id: 1,
      email: 'internationalsafetysolution@gmail.com',
      password: 'Admin@1236#',
      name: 'System Administrator',
      role: 'ADMIN',
      designation: null
    }
  ],
  clients: [],
  order_types: [
    { id: 1, name: 'Refilling Service' },
    { id: 2, name: 'Installation Project' },
    { id: 3, name: 'Maintenance Request' }
  ],
  orders: []
};

// Check if we should use MySQL
const isMySQLConfigured = () => {
  return !!(
    process.env.DB_HOST &&
    process.env.DB_USER &&
    process.env.DB_NAME
  );
};

// Caching MySQL connection pool globally in development to prevent duplicate pools on hot reloads
let pool = global.mysqlPool || null;
let mysqlFailed = false;

async function ensureDatabaseAndPool() {
  if (global.mysqlPool) {
    pool = global.mysqlPool;
    return pool;
  }
  if (pool) return pool;

  if (!isMySQLConfigured()) {
    return null;
  }

  try {
    const host = process.env.DB_HOST || 'localhost';
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD || process.env.DB_PASS || '';
    const database = process.env.DB_NAME;
    const port = parseInt(process.env.DB_PORT || '3306', 10);

    console.log(`Connecting to MySQL at ${host}:${port} as ${user}...`);

    // Initialize the connection pool directly without unprivileged CREATE DATABASE checks
    pool = mysql.createPool({
      host,
      user,
      password,
      database,
      port,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      idleTimeout: 60000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      timezone: '+05:00',
      dateStrings: true
    });

    global.mysqlPool = pool;
    console.log('MySQL Connection Pool created successfully.');

    // Auto-create settings table if it doesn't exist
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS settings (
          id INT PRIMARY KEY,
          app_name VARCHAR(255) NOT NULL,
          app_logo LONGTEXT NULL,
          favicon LONGTEXT NULL,
          logo_width INT NOT NULL DEFAULT 150,
          reupload_buffer_time INT NOT NULL DEFAULT 20,
          max_reupload_count INT NOT NULL DEFAULT 3,
          smtp_host VARCHAR(255) NULL,
          smtp_port INT NULL,
          smtp_user VARCHAR(255) NULL,
          smtp_pass VARCHAR(255) NULL,
          smtp_secure VARCHAR(50) NULL DEFAULT 'none',
          smtp_sender_name VARCHAR(255) NULL,
          smtp_sender_email VARCHAR(255) NULL
        )
      `);

      // Check and add logo_width column if table existed previously without it
      const [columns] = await pool.execute('SHOW COLUMNS FROM settings');
      const hasLogoWidth = columns.some(col => col.Field === 'logo_width');
      if (!hasLogoWidth) {
        await pool.execute('ALTER TABLE settings ADD COLUMN logo_width INT NOT NULL DEFAULT 150');
        console.log('MySQL logo_width column added to settings table.');
      }

      // Check and add reupload_buffer_time column if table existed previously without it
      const hasReuploadBuffer = columns.some(col => col.Field === 'reupload_buffer_time');
      if (!hasReuploadBuffer) {
        await pool.execute('ALTER TABLE settings ADD COLUMN reupload_buffer_time INT NOT NULL DEFAULT 20');
        console.log('MySQL reupload_buffer_time column added to settings table.');
      }

      // Check and add max_reupload_count column
      const hasMaxReupload = columns.some(col => col.Field === 'max_reupload_count');
      if (!hasMaxReupload) {
        await pool.execute('ALTER TABLE settings ADD COLUMN max_reupload_count INT NOT NULL DEFAULT 3');
        console.log('MySQL max_reupload_count column added to settings table.');
      }

      // Check and add refilling_order_types column
      const hasRefillingOrderTypes = columns.some(col => col.Field === 'refilling_order_types');
      if (!hasRefillingOrderTypes) {
        await pool.execute('ALTER TABLE settings ADD COLUMN refilling_order_types TEXT NULL');
        console.log('MySQL refilling_order_types column added to settings table.');
      }

      // Check and add refilling_automation_rules column
      const hasRefillingAutomation = columns.some(col => col.Field === 'refilling_automation_rules');
      if (!hasRefillingAutomation) {
        await pool.execute('ALTER TABLE settings ADD COLUMN refilling_automation_rules TEXT NULL');
        console.log('MySQL refilling_automation_rules column added to settings table.');
      }

      // Check and add SMTP columns
      const smtpColumns = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_secure', 'smtp_sender_name', 'smtp_sender_email'];
      for (const col of smtpColumns) {
        const hasCol = columns.some(c => c.Field === col);
        if (!hasCol) {
          const typeDef = col === 'smtp_port' ? 'INT NULL' : (col === 'smtp_secure' ? "VARCHAR(50) NULL DEFAULT 'none'" : 'VARCHAR(255) NULL');
          await pool.execute(`ALTER TABLE settings ADD COLUMN ${col} ${typeDef}`);
          console.log(`MySQL ${col} column added to settings table.`);
        }
      }

      const [rows] = await pool.execute('SELECT COUNT(*) as count FROM settings');
      if (rows[0].count === 0) {
        await pool.execute(
          'INSERT IGNORE INTO settings (id, app_name, app_logo, favicon, logo_width, reupload_buffer_time, max_reupload_count) VALUES (1, ?, NULL, NULL, 150, 20, 3)',
          ['ISS PORTAL']
        );
      }
      console.log('MySQL settings table auto-verified/created.');

      // Create email_templates table with toggle columns
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS email_templates (
          id INT AUTO_INCREMENT PRIMARY KEY,
          template_key VARCHAR(50) NOT NULL UNIQUE,
          name VARCHAR(100) NOT NULL,
          subject VARCHAR(255) NOT NULL,
          body TEXT NOT NULL,
          variables VARCHAR(255) NOT NULL,
          notify_admin TINYINT NOT NULL DEFAULT 1,
          notify_staff_1 TINYINT NOT NULL DEFAULT 1,
          notify_staff_2 TINYINT NOT NULL DEFAULT 1,
          notify_staff_3 TINYINT NOT NULL DEFAULT 1
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Ensure columns exist on existing databases
      try {
        await pool.execute('ALTER TABLE email_templates ADD COLUMN notify_admin TINYINT NOT NULL DEFAULT 1');
      } catch (e) { }
      try {
        await pool.execute('ALTER TABLE email_templates ADD COLUMN notify_staff_1 TINYINT NOT NULL DEFAULT 1');
      } catch (e) { }
      try {
        await pool.execute('ALTER TABLE email_templates ADD COLUMN notify_staff_2 TINYINT NOT NULL DEFAULT 1');
      } catch (e) { }
      try {
        await pool.execute('ALTER TABLE email_templates ADD COLUMN notify_staff_3 TINYINT NOT NULL DEFAULT 1');
      } catch (e) { }

      const [templateRows] = await pool.execute('SELECT COUNT(*) as count FROM email_templates');
      if (templateRows[0].count === 0) {
        const allVariables = 'order_id, client_name, order_type, qty, po_no, deadline_date, receiver_name, courier_id, stage_number, buffer_time, completion_time';
        await pool.execute(`
          INSERT IGNORE INTO email_templates (template_key, name, subject, body, variables, notify_admin, notify_staff_1, notify_staff_2, notify_staff_3) VALUES 
          ('order_created', 'New Order Notification', 'New Order #[order_id] Registered', '<h3>Dear [client_name],</h3><p>Your order #<strong>[order_id]</strong> has been registered on the portal.</p><p>Order Type: [order_type] | Quantity: [qty] | PO: [po_no]</p><p>Deadline: [deadline_date]</p><p>Please log in to your dashboard to review status.</p><p>Regards,<br>ISS Team</p>', ?, 1, 1, 1, 1),
          ('stage1_completed', 'Stage 1 Completed', 'Order #[order_id] - Stage 1 (Delivery Challan) Completed', '<h3>Hello Accounts Department,</h3><p>Stage 1 has been completed for order #<strong>[order_id]</strong>. Received by: [receiver_name].</p><p>Invoice uploading is now pending for your action.</p>', ?, 1, 0, 1, 0),
          ('stage2_completed', 'Stage 2 Completed', 'Order #[order_id] - Stage 2 (Invoice) Completed', '<h3>Hello Logistics Department,</h3><p>Stage 2 has been completed for order #<strong>[order_id]</strong>.</p><p>Courier dispatch registration is now pending for your action.</p>', ?, 1, 0, 0, 1),
          ('order_completed', 'Order Completed', 'Order #[order_id] Completed & Dispatched', '<h3>Dear client [client_name],</h3><p>Your order #<strong>[order_id]</strong> is now fully complete.</p><p>Courier tracking ID: [courier_id].</p>', ?, 1, 1, 1, 1),
          ('reupload_requested', 'Task Reupload Request', 'Reupload Required for Order #[order_id]', '<h3>Hello,</h3><p>A reupload request has been generated for order #<strong>[order_id]</strong>.</p><p>Please upload the corrected documents within the portal before the buffer timer expires.</p>', ?, 1, 1, 1, 1)
        `, [allVariables, allVariables, allVariables, allVariables, allVariables]);
      }

      // Guarantee staff_registered template is present on existing databases
      try {
        await pool.execute(`
          INSERT IGNORE INTO email_templates (template_key, name, subject, body, variables, notify_admin, notify_staff_1, notify_staff_2, notify_staff_3) VALUES 
          ('staff_registered', 'Staff Account Registered', 'Welcome to ISS Portal - Your Account Credentials', '<h3>Welcome [user_name],</h3><p>Your staff account has been created on the ISS Portal.</p><p><strong>Email:</strong> [user_email]</p><p><strong>Temporary Password:</strong> [temp_password]</p><p>Please log in to your account at [portal_url] and change your password on first login.</p>', 'user_name, user_email, temp_password, portal_url', 0, 0, 0, 0)
        `);
      } catch (e) { }

      // Guarantee refilling_reminder template is present on existing databases
      try {
        const defaultRefillingBody = '<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;"><div style="background-color: #ea580c; padding: 18px 24px; color: #ffffff;"><h2 style="margin: 0; font-size: 20px;">International Safety Solution</h2><p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Fire Safety &amp; Equipment Maintenance Department</p></div><div style="padding: 24px;"><p style="font-size: 15px; margin-top: 0;">Dear <strong>[client_name]</strong>,</p><p style="font-size: 14px; color: #4b5563;">This is a safety reminder regarding your fire safety equipment under Order #<strong>[order_id]</strong>.</p><div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 18px 0;"><table style="width: 100%; font-size: 14px; border-collapse: collapse;"><tr><td style="padding: 6px 0; color: #64748b; width: 40%;"><strong>Order / Service:</strong></td><td style="padding: 6px 0; color: #0f172a; font-weight: 600;">[order_type]</td></tr><tr><td style="padding: 6px 0; color: #64748b;"><strong>Quantity:</strong></td><td style="padding: 6px 0; color: #0f172a;">[qty] units</td></tr><tr><td style="padding: 6px 0; color: #64748b;"><strong>Order Date:</strong></td><td style="padding: 6px 0; color: #0f172a;">[order_date]</td></tr><tr><td style="padding: 6px 0; color: #64748b;"><strong>Expiry / Due Date:</strong></td><td style="padding: 6px 0; color: #dc2626; font-weight: bold;">[expiry_date]</td></tr><tr><td style="padding: 6px 0; color: #64748b;"><strong>Days Remaining:</strong></td><td style="padding: 6px 0; color: #ea580c; font-weight: 600;">[days_left] days</td></tr><tr><td style="padding: 6px 0; color: #64748b;"><strong>Alert Status:</strong></td><td style="padding: 6px 0;">[alert_badge]</td></tr></table></div><p style="font-size: 14px; color: #4b5563;">[scenario_text]</p><p style="font-size: 14px; color: #4b5563;">According to fire safety regulations and standards, all fire extinguishers must be professionally inspected, serviced, and refilled annually to ensure they function properly in an emergency.</p><p style="font-size: 14px; color: #4b5563;">Please contact us at your earliest convenience to arrange an on-site service, pickup, or refilling so your equipment remains fully compliant and operational.</p><div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 13px; color: #6b7280;"><p style="margin: 0;"><strong>International Safety Solution (ISS)</strong></p><p style="margin: 2px 0;">Phone: 0321-7654321 / 0300-1234567</p><p style="margin: 2px 0;">Email: internationalsafetysolution@gmail.com</p></div></div></div>';
        const refillingVars = 'client_name, order_id, order_type, qty, order_date, expiry_date, days_left, alert_badge, scenario_text, portal_url';
        await pool.execute(`
          INSERT IGNORE INTO email_templates (template_key, name, subject, body, variables, notify_admin, notify_staff_1, notify_staff_2, notify_staff_3) VALUES 
          ('refilling_reminder', 'Refilling Follow Up', 'Urgent Reminder: Fire Extinguisher Refilling / Inspection Due - [client_name] (Order #[order_id])', ?, ?, 0, 0, 0, 0)
        `, [defaultRefillingBody, refillingVars]);
        await pool.execute("UPDATE email_templates SET name = 'Refilling Follow Up' WHERE template_key = 'refilling_reminder'");
      } catch (e) { }

      console.log('MySQL email_templates table verified/created.');

      // Auto-create users table
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL,
          designation VARCHAR(100) NULL,
          permission_scopes TEXT NULL,
          must_change_password TINYINT NOT NULL DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      try {
        await pool.execute('ALTER TABLE users ADD COLUMN must_change_password TINYINT NOT NULL DEFAULT 0');
      } catch (e) { }
      try {
        await pool.execute('ALTER TABLE users ADD COLUMN permission_scopes TEXT NULL');
      } catch (e) { }

      // Auto-create clients table
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS clients (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NULL,
          phone VARCHAR(100) NULL,
          address TEXT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      try {
        await pool.execute('ALTER TABLE clients MODIFY COLUMN email VARCHAR(255) NULL');
      } catch (e) { }
      try {
        await pool.execute('ALTER TABLE clients MODIFY COLUMN phone VARCHAR(100) NULL');
      } catch (e) { }
      try {
        await pool.execute('ALTER TABLE clients MODIFY COLUMN address TEXT NULL');
      } catch (e) { }

      // Auto-create order_types table
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS order_types (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Auto-create orders table
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS orders (
          id INT AUTO_INCREMENT PRIMARY KEY,
          client_id INT NOT NULL,
          order_type_id INT NULL,
          details TEXT NOT NULL,
          qty INT NULL,
          deadline_date VARCHAR(100) NULL,
          status VARCHAR(100) NOT NULL,
          assigned_staff_1_id INT NULL,
          assigned_staff_2_id INT NULL,
          assigned_staff_3_id INT NULL,
          dc_image_path TEXT NULL,
          received_by VARCHAR(255) NULL,
          invoice_image_path TEXT NULL,
          tracking_id VARCHAR(255) NULL,
          po_no VARCHAR(255) NULL,
          po_file_path TEXT NULL,
          stage1_completed_at DATETIME NULL,
          stage2_completed_at DATETIME NULL,
          stage3_completed_at DATETIME NULL,
          stage1_edit_count INT DEFAULT 0,
          stage2_edit_count INT DEFAULT 0,
          stage3_edit_count INT DEFAULT 0,
          stage1_opened_at DATETIME NULL,
          stage2_opened_at DATETIME NULL,
          stage3_opened_at DATETIME NULL,
          stage1_reupload_times TEXT NULL,
          stage2_reupload_times TEXT NULL,
          stage3_reupload_times TEXT NULL,
          stage1_upload_history TEXT NULL,
          created_by_id INT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Auto-create permission_scopes table
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS permission_scopes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          permissions LONGTEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Auto-create email_logs table for enterprise audit trail
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS email_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          recipient VARCHAR(255) NOT NULL,
          subject VARCHAR(255) NOT NULL,
          template_key VARCHAR(100) NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'SENT',
          error_message TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Performance Optimization Indexes on orders table
      const orderIndexes = [
        'CREATE INDEX idx_orders_client_id ON orders(client_id)',
        'CREATE INDEX idx_orders_status ON orders(status)',
        'CREATE INDEX idx_orders_staff_1 ON orders(assigned_staff_1_id)',
        'CREATE INDEX idx_orders_staff_2 ON orders(assigned_staff_2_id)',
        'CREATE INDEX idx_orders_staff_3 ON orders(assigned_staff_3_id)',
        'CREATE INDEX idx_orders_created_at ON orders(created_at)'
      ];
      for (const idxQuery of orderIndexes) {
        try {
          await pool.execute(idxQuery);
        } catch (e) {
          // Index already exists, safe to ignore
        }
      }

      try {
        await pool.execute('ALTER TABLE orders ADD COLUMN stage1_upload_history TEXT NULL');
      } catch (e) { }

      try {
        await pool.execute('ALTER TABLE permission_scopes ADD COLUMN name VARCHAR(255) NULL');
      } catch (e) { }
      try {
        await pool.execute('ALTER TABLE permission_scopes ADD COLUMN permissions LONGTEXT NULL');
      } catch (e) { }

      // Seed default System Administrator ONLY if users table is completely empty (first-time fresh install)
      const [userCountRows] = await pool.execute('SELECT COUNT(*) as count FROM users');
      const userCount = userCountRows && userCountRows[0] ? Number(userCountRows[0].count) : 0;
      if (userCount === 0) {
        await pool.execute(
          'INSERT INTO users (email, password, name, role, designation, must_change_password) VALUES (?, ?, ?, ?, ?, 0)',
          ['internationalsafetysolution@gmail.com', 'Admin@1236#', 'System Administrator', 'ADMIN', null]
        );
      }

      console.log('MySQL all tables (users, clients, orders, order_types, permission_scopes) verified/created.');
    } catch (e) {
      console.error('Failed to auto-create database tables:', e.message);
    }

    return pool;
  } catch (error) {
    console.error('MySQL Connection/Creation failed:', error.message);
    pool = null;
    global.mysqlPool = null;
    return null;
  }
}

// Local File Helper (Fallback)
const readMockDb = () => {
  try {
    if (!fs.existsSync(MOCK_DB_PATH)) {
      // Ensure folder exists
      fs.mkdirSync(path.dirname(MOCK_DB_PATH), { recursive: true });
      fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(initialMockData, null, 2));
      return initialMockData;
    }
    const data = fs.readFileSync(MOCK_DB_PATH, 'utf8');
    const parsed = JSON.parse(data);
    if (!parsed.order_types) {
      parsed.order_types = initialMockData.order_types;
      fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(parsed, null, 2));
    }
    return parsed;
  } catch (err) {
    console.error('Error reading mock DB file:', err);
    return initialMockData;
  }
};

const writeMockDb = (data) => {
  try {
    fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error writing mock DB file:', err);
  }
};

// Database interface
export async function query(sql, params = []) {
  const activePool = await ensureDatabaseAndPool();

  if (activePool) {
    try {
      const [results] = await activePool.execute(sql, params);
      return results;
    } catch (error) {
      console.error('MySQL query execution failed. Falling back. Error:', error.message);
      // Fallback is handled below
    }
  }

  // Fallback database operations
  return handleMockQuery(sql, params);
}

// Simple SQL Parser for the Mock Database to keep Next.js running seamlessly without MySQL
function handleMockQuery(sql, params) {
  const db = readMockDb();
  const sqlNormalized = sql.trim().replace(/\s+/g, ' ').toLowerCase();

  // SELECT * FROM permission_scopes
  if (sqlNormalized.startsWith('select') && sqlNormalized.includes('from permission_scopes')) {
    let list = db.permission_scopes || [];
    if (sqlNormalized.includes('where id = ?')) {
      const id = parseInt(params[0]);
      list = list.filter(s => s.id === id);
    }
    return list;
  }

  // SELECT * FROM order_types
  if (sqlNormalized.startsWith('select') && sqlNormalized.includes('from order_types')) {
    let list = db.order_types || [];
    if (sqlNormalized.includes('where id = ?')) {
      const id = parseInt(params[0]);
      list = list.filter(t => t.id === id);
    }
    return list;
  }

  // SELECT * FROM users
  if (sqlNormalized.startsWith('select') && sqlNormalized.includes('from users')) {
    let list = db.users;
    if (sqlNormalized.includes('email = ?') && sqlNormalized.includes('id != ?')) {
      const email = params[0];
      const excludeId = parseInt(params[1]);
      list = list.filter(u => u.email.trim().toLowerCase() === email.trim().toLowerCase() && u.id !== excludeId);
    } else if (sqlNormalized.includes('email = ?')) {
      const email = params[0];
      list = list.filter(u => u.email.trim().toLowerCase() === email.trim().toLowerCase());
    } else if (sqlNormalized.includes('where designation = ?')) {
      const des = params[0];
      list = list.filter(u => u.designation === des);
    } else if (sqlNormalized.includes('where id = ?')) {
      const id = parseInt(params[0]);
      list = list.filter(u => u.id === id);
    }
    return list;
  }

  // SELECT * FROM clients
  if (sqlNormalized.startsWith('select') && sqlNormalized.includes('from clients')) {
    let list = db.clients.map(client => {
      const clientOrders = (db.orders || []).filter(o => Number(o.client_id) === Number(client.id));
      const completed = clientOrders.filter(o => o.status === 'COMPLETED').length;
      const inProgress = clientOrders.filter(o => o.status === 'PENDING_INVOICE' || o.status === 'PENDING_COURIER').length;
      const pending = clientOrders.filter(o => o.status === 'PENDING_TASK' || o.status === 'PENDING' || !o.status).length;
      return {
        ...client,
        total_orders: clientOrders.length,
        completed_orders: completed,
        in_progress_orders: inProgress,
        pending_orders: pending
      };
    });
    if (sqlNormalized.includes('where id = ?')) {
      const id = parseInt(params[0]);
      list = list.filter(c => c.id === id);
    }
    return list;
  }

  // SELECT * FROM email_templates
  if (sqlNormalized.startsWith('select') && sqlNormalized.includes('from email_templates')) {
    const allVars = 'order_id, client_name, order_type, qty, po_no, deadline_date, receiver_name, courier_id, stage_number, buffer_time, completion_time';
    const defaultRefillingBody = '<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;"><div style="background-color: #ea580c; padding: 18px 24px; color: #ffffff;"><h2 style="margin: 0; font-size: 20px;">International Safety Solution</h2><p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Fire Safety &amp; Equipment Maintenance Department</p></div><div style="padding: 24px;"><p style="font-size: 15px; margin-top: 0;">Dear <strong>[client_name]</strong>,</p><p style="font-size: 14px; color: #4b5563;">This is a safety reminder regarding your fire safety equipment under Order #<strong>[order_id]</strong>.</p><div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 18px 0;"><table style="width: 100%; font-size: 14px; border-collapse: collapse;"><tr><td style="padding: 6px 0; color: #64748b; width: 40%;"><strong>Order / Service:</strong></td><td style="padding: 6px 0; color: #0f172a; font-weight: 600;">[order_type]</td></tr><tr><td style="padding: 6px 0; color: #64748b;"><strong>Quantity:</strong></td><td style="padding: 6px 0; color: #0f172a;">[qty] units</td></tr><tr><td style="padding: 6px 0; color: #64748b;"><strong>Order Date:</strong></td><td style="padding: 6px 0; color: #0f172a;">[order_date]</td></tr><tr><td style="padding: 6px 0; color: #64748b;"><strong>Expiry / Due Date:</strong></td><td style="padding: 6px 0; color: #dc2626; font-weight: bold;">[expiry_date]</td></tr><tr><td style="padding: 6px 0; color: #64748b;"><strong>Days Remaining:</strong></td><td style="padding: 6px 0; color: #ea580c; font-weight: 600;">[days_left] days</td></tr><tr><td style="padding: 6px 0; color: #64748b;"><strong>Alert Status:</strong></td><td style="padding: 6px 0;">[alert_badge]</td></tr></table></div><p style="font-size: 14px; color: #4b5563;">[scenario_text]</p><p style="font-size: 14px; color: #4b5563;">According to fire safety regulations and standards, all fire extinguishers must be professionally inspected, serviced, and refilled annually to ensure they function properly in an emergency.</p><p style="font-size: 14px; color: #4b5563;">Please contact us at your earliest convenience to arrange an on-site service, pickup, or refilling so your equipment remains fully compliant and operational.</p><div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 13px; color: #6b7280;"><p style="margin: 0;"><strong>International Safety Solution (ISS)</strong></p><p style="margin: 2px 0;">Phone: 0321-7654321 / 0300-1234567</p><p style="margin: 2px 0;">Email: internationalsafetysolution@gmail.com</p></div></div></div>';

    if (!db.email_templates || db.email_templates.length === 0) {
      db.email_templates = [
        { id: 1, template_key: 'order_created', name: 'New Order Notification', subject: 'New Order #[order_id] Registered', body: '<h3>Dear [client_name],</h3><p>Your order #<strong>[order_id]</strong> has been registered on the portal.</p><p>Order Type: [order_type] | Quantity: [qty] | PO: [po_no]</p><p>Deadline: [deadline_date]</p><p>Please log in to your dashboard to review status.</p><p>Regards,<br>ISS Team</p>', variables: allVars, notify_admin: 1, notify_staff_1: 1, notify_staff_2: 1, notify_staff_3: 1 },
        { id: 2, template_key: 'stage1_completed', name: 'Stage 1 Completed', subject: 'Order #[order_id] - Stage 1 (Delivery Challan) Completed', body: '<h3>Hello Accounts Department,</h3><p>Stage 1 has been completed for order #<strong>[order_id]</strong>. Received by: [receiver_name].</p><p>Invoice uploading is now pending for your action.</p>', variables: allVars, notify_admin: 1, notify_staff_1: 0, notify_staff_2: 1, notify_staff_3: 0 },
        { id: 3, template_key: 'stage2_completed', name: 'Stage 2 Completed', subject: 'Order #[order_id] - Stage 2 (Invoice) Completed', body: '<h3>Hello Logistics Department,</h3><p>Stage 2 has been completed for order #<strong>[order_id]</strong>.</p><p>Courier dispatch registration is now pending for your action.</p>', variables: allVars, notify_admin: 1, notify_staff_1: 0, notify_staff_2: 0, notify_staff_3: 1 },
        { id: 4, template_key: 'order_completed', name: 'Order Completed', subject: 'Order #[order_id] Completed & Dispatched', body: '<h3>Dear client [client_name],</h3><p>Your order #<strong>[order_id]</strong> is now fully complete.</p><p>Courier tracking ID: [courier_id].</p>', variables: allVars, notify_admin: 1, notify_staff_1: 1, notify_staff_2: 1, notify_staff_3: 1 },
        { id: 5, template_key: 'reupload_requested', name: 'Task Reupload Request', subject: 'Reupload Required for Order #[order_id]', body: '<h3>Hello,</h3><p>A reupload request has been generated for order #<strong>[order_id]</strong>.</p><p>Please upload the corrected documents within the portal before the buffer timer expires.</p>', variables: allVars, notify_admin: 1, notify_staff_1: 1, notify_staff_2: 1, notify_staff_3: 1 },
        { id: 6, template_key: 'staff_registered', name: 'Staff Account Registered', subject: 'Welcome to ISS Portal - Your Account Credentials', body: '<h3>Welcome [user_name],</h3><p>Your staff account has been created on the ISS Portal.</p><p><strong>Email:</strong> [user_email]</p><p><strong>Temporary Password:</strong> [temp_password]</p><p>Please log in to your account at [portal_url] and change your password on first login.</p>', variables: 'user_name, user_email, temp_password, portal_url', notify_admin: 0, notify_staff_1: 0, notify_staff_2: 0, notify_staff_3: 0 },
        { id: 7, template_key: 'refilling_reminder', name: 'Refilling Follow Up', subject: 'Urgent Reminder: Fire Extinguisher Refilling / Inspection Due - [client_name] (Order #[order_id])', body: defaultRefillingBody, variables: 'client_name, order_id, order_type, qty, order_date, expiry_date, days_left, alert_badge, scenario_text, portal_url', notify_admin: 0, notify_staff_1: 0, notify_staff_2: 0, notify_staff_3: 0 }
      ];
      writeMockDb(db);
    } else {
      const hasRefilling = db.email_templates.some(t => t.template_key === 'refilling_reminder');
      if (!hasRefilling) {
        db.email_templates.push({
          id: db.email_templates.length + 1,
          template_key: 'refilling_reminder',
          name: 'Refilling Follow Up',
          subject: 'Urgent Reminder: Fire Extinguisher Refilling / Inspection Due - [client_name] (Order #[order_id])',
          body: defaultRefillingBody,
          variables: 'client_name, order_id, order_type, qty, order_date, expiry_date, days_left, alert_badge, scenario_text, portal_url',
          notify_admin: 0,
          notify_staff_1: 0,
          notify_staff_2: 0,
          notify_staff_3: 0
        });
        writeMockDb(db);
      }
    }

    let list = [...db.email_templates];
    if (sqlNormalized.includes('where template_key = ?')) {
      const key = params[0];
      list = list.filter(t => t.template_key === key);
    } else if (sqlNormalized.includes('where id = ?')) {
      const id = parseInt(params[0]);
      list = list.filter(t => t.id === id);
    }
    return list;
  }

  // SELECT * FROM settings
  if (sqlNormalized.startsWith('select') && sqlNormalized.includes('from settings')) {
    if (!db.settings || db.settings.length === 0) {
      db.settings = [{ id: 1, app_name: 'ISS PORTAL', app_logo: null, favicon: null, logo_width: 150, reupload_buffer_time: 20, max_reupload_count: 3 }];
      writeMockDb(db);
    }
    let modified = false;
    if (db.settings[0]) {
      if (db.settings[0].logo_width === undefined) {
        db.settings[0].logo_width = 150;
        modified = true;
      }
      if (db.settings[0].reupload_buffer_time === undefined) {
        db.settings[0].reupload_buffer_time = 20;
        modified = true;
      }
      if (db.settings[0].max_reupload_count === undefined) {
        db.settings[0].max_reupload_count = 3;
        modified = true;
      }
      if (db.settings[0].refilling_order_types === undefined) {
        db.settings[0].refilling_order_types = '[]';
        modified = true;
      }
      if (db.settings[0].refilling_automation_rules === undefined) {
        db.settings[0].refilling_automation_rules = '[]';
        modified = true;
      }
    }
    if (modified) {
      writeMockDb(db);
    }
    return db.settings;
  }


  // SELECT * FROM orders
  if (sqlNormalized.startsWith('select') && sqlNormalized.includes('from orders')) {
    // Populate orders with client, order_type and staff details
    let list = db.orders.map(order => {
      const client = db.clients.find(c => c.id === order.client_id) || {};
      const type = (db.order_types || []).find(t => t.id === order.order_type_id) || {};
      const staff1 = db.users.find(u => u.id === order.assigned_staff_1_id) || {};
      const staff2 = db.users.find(u => u.id === order.assigned_staff_2_id) || {};
      const staff3 = db.users.find(u => u.id === order.assigned_staff_3_id) || {};
      const creator = db.users.find(u => u.id === order.created_by_id) || {};
      return {
        ...order,
        client_name: client.name,
        client_email: client.email || '',
        client_phone: client.phone,
        client_address: client.address,
        order_type_name: type.name || 'N/A',
        staff_1_name: staff1.name,
        staff_2_name: staff2.name,
        staff_3_name: staff3.name,
        created_by_name: creator.name || 'Admin User'
      };
    });

    // Handle WHERE clauses
    if (sqlNormalized.includes('where assigned_staff_1_id = ?') || sqlNormalized.includes('where staff_1 = ?')) {
      const id = parseInt(params[0]);
      list = list.filter(o => o.assigned_staff_1_id === id);
    } else if (sqlNormalized.includes('where assigned_staff_2_id = ?')) {
      const id = parseInt(params[0]);
      list = list.filter(o => o.assigned_staff_2_id === id);
    } else if (sqlNormalized.includes('where assigned_staff_3_id = ?')) {
      const id = parseInt(params[0]);
      list = list.filter(o => o.assigned_staff_3_id === id);
    } else if (sqlNormalized.includes('where id = ?')) {
      const id = parseInt(params[0]);
      list = list.filter(o => o.id === id);
    }

    // Sort descending by id
    list.sort((a, b) => b.id - a.id);
    return list;
  }

  // INSERT INTO order_types
  if (sqlNormalized.startsWith('insert into order_types')) {
    if (!db.order_types) db.order_types = [];
    const newType = {
      id: db.order_types.length ? Math.max(...db.order_types.map(t => t.id)) + 1 : 1,
      name: params[0]
    };
    db.order_types.push(newType);
    writeMockDb(db);
    return { insertId: newType.id, affectedRows: 1 };
  }

  // INSERT INTO permission_scopes
  if (sqlNormalized.startsWith('insert into permission_scopes')) {
    if (!db.permission_scopes) db.permission_scopes = [];
    const newScope = {
      id: db.permission_scopes.length ? Math.max(...db.permission_scopes.map(s => s.id)) + 1 : 1,
      name: params[0],
      permissions: typeof params[1] === 'string' ? JSON.parse(params[1]) : params[1]
    };
    db.permission_scopes.push(newScope);
    writeMockDb(db);
    return { insertId: newScope.id, affectedRows: 1 };
  }

  // INSERT INTO users
  if (sqlNormalized.startsWith('insert into users')) {
    const newUser = {
      id: db.users.length ? Math.max(...db.users.map(u => u.id)) + 1 : 1,
      email: params[0],
      password: params[1],
      name: params[2],
      role: params[3],
      designation: params[4] || null,
      permissions: null,
      permission_scopes: params[5] || null
    };
    db.users.push(newUser);
    writeMockDb(db);
    return { insertId: newUser.id, affectedRows: 1 };
  }

  // INSERT INTO clients
  if (sqlNormalized.startsWith('insert into clients')) {
    const newClient = {
      id: db.clients.length ? Math.max(...db.clients.map(c => c.id)) + 1 : 1,
      name: params[0],
      email: params[1],
      phone: params[2],
      address: params[3]
    };
    db.clients.push(newClient);
    writeMockDb(db);
    return { insertId: newClient.id, affectedRows: 1 };
  }

  // INSERT INTO orders
  if (sqlNormalized.startsWith('insert into orders')) {
    const hasExplicitId = sqlNormalized.includes('(id,') || sqlNormalized.includes('(id ,') || params.length === 14;
    const pOffset = hasExplicitId ? 1 : 0;
    let orderId = hasExplicitId ? parseInt(params[0]) : null;
    if (!orderId) {
      const existingIds = new Set((db.orders || []).map(o => o.id));
      let nextId = 1;
      while (existingIds.has(nextId)) nextId++;
      orderId = nextId;
    }

    const newOrder = {
      id: orderId,
      client_id: parseInt(params[0 + pOffset]),
      order_type_id: params[1 + pOffset] ? parseInt(params[1 + pOffset]) : null,
      details: params[2 + pOffset],
      qty: parseInt(params[3 + pOffset] || '0'),
      deadline_date: params[4 + pOffset],
      status: params[5 + pOffset], // e.g. PENDING_TASK
      assigned_staff_1_id: parseInt(params[6 + pOffset]),
      assigned_staff_2_id: parseInt(params[7 + pOffset]),
      assigned_staff_3_id: parseInt(params[8 + pOffset]),
      po_no: params[9 + pOffset] || null,
      po_file_path: params[10 + pOffset] || null,
      created_by_id: params[11 + pOffset] ? parseInt(params[11 + pOffset]) : 1,
      stage1_opened_at: params[12 + pOffset] || null,
      dc_image_path: null,
      received_by: null,
      invoice_image_path: null,
      tracking_id: null,
      stage1_completed_at: null,
      stage2_completed_at: null,
      stage3_completed_at: null,
      stage2_opened_at: null,
      stage3_opened_at: null,
      stage1_edit_count: 0,
      stage2_edit_count: 0,
      stage3_edit_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.orders.push(newOrder);
    writeMockDb(db);
    return { insertId: newOrder.id, affectedRows: 1 };
  }

  // UPDATE order_types
  if (sqlNormalized.startsWith('update order_types')) {
    if (!db.order_types) db.order_types = [];
    const typeId = parseInt(params[params.length - 1]);
    const idx = db.order_types.findIndex(t => t.id === typeId);
    if (idx !== -1) {
      db.order_types[idx].name = params[0];
      writeMockDb(db);
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  // UPDATE orders
  if (sqlNormalized.startsWith('update orders')) {
    const orderId = parseInt(params[params.length - 1]);
    const idx = db.orders.findIndex(o => o.id === orderId);
    if (idx !== -1) {
      db.orders[idx].updated_at = new Date().toISOString();

      if (sqlNormalized.includes('client_id = ?')) {
        // Admin update order details
        db.orders[idx].client_id = parseInt(params[0]);
        db.orders[idx].order_type_id = params[1] ? parseInt(params[1]) : null;
        db.orders[idx].details = params[2];
        db.orders[idx].qty = parseInt(params[3] || '0');
        db.orders[idx].deadline_date = params[4];
        db.orders[idx].assigned_staff_1_id = parseInt(params[5]);
        db.orders[idx].assigned_staff_2_id = parseInt(params[6]);
        db.orders[idx].assigned_staff_3_id = parseInt(params[7]);
        if (sqlNormalized.includes('po_no = ?')) {
          db.orders[idx].po_no = params[8];
          db.orders[idx].po_file_path = params[9];
        }
      } else if (sqlNormalized.includes('dc_image_path = ?') && sqlNormalized.includes('stage1_edit_count = ?') && sqlNormalized.includes('stage2_opened_at = ?')) {
        // Stage 1 re-upload with limit reached (forces stage 2 to open immediately)
        db.orders[idx].dc_image_path = params[0];
        db.orders[idx].received_by = params[1];
        db.orders[idx].stage1_edit_count = parseInt(params[2]);
        db.orders[idx].stage1_reupload_times = params[3] || '[]';
        db.orders[idx].stage2_opened_at = params[4];
      } else if (sqlNormalized.includes('dc_image_path = ?') && sqlNormalized.includes('stage1_edit_count = ?')) {
        // Stage 1 re-upload (with edit count and reupload times)
        db.orders[idx].dc_image_path = params[0];
        db.orders[idx].received_by = params[1];
        db.orders[idx].stage1_edit_count = parseInt(params[2]);
        db.orders[idx].stage1_reupload_times = params[3] || '[]';
      } else if (sqlNormalized.includes('dc_image_path = ?') && sqlNormalized.includes('stage2_opened_at = ?')) {
        // Stage 1 initial completion with stage 2 opened time
        db.orders[idx].dc_image_path = params[0];
        db.orders[idx].received_by = params[1];
        db.orders[idx].stage1_completed_at = params[2];
        db.orders[idx].stage2_opened_at = params[3];
        db.orders[idx].status = params[4];
      } else if (sqlNormalized.includes('dc_image_path = ?') && sqlNormalized.includes('received_by = ?')) {
        db.orders[idx].dc_image_path = params[0];
        db.orders[idx].received_by = params[1];
        db.orders[idx].stage1_completed_at = params[2];
        db.orders[idx].status = params[3];
      } else if (sqlNormalized.includes('dc_image_path = ?') && sqlNormalized.includes('stage1_completed_at = ?')) {
        // Stage 1 completion (compatibility fallback)
        db.orders[idx].dc_image_path = params[0];
        db.orders[idx].stage1_completed_at = params[1];
        db.orders[idx].status = params[2];
      } else if (sqlNormalized.includes('invoice_image_path = ?') && sqlNormalized.includes('stage2_edit_count = ?') && sqlNormalized.includes('stage3_opened_at = ?')) {
        // Stage 2 re-upload with limit reached (forces stage 3 to open immediately)
        db.orders[idx].invoice_image_path = params[0];
        db.orders[idx].stage2_edit_count = parseInt(params[1]);
        db.orders[idx].stage2_reupload_times = params[2] || '[]';
        db.orders[idx].stage3_opened_at = params[3];
      } else if (sqlNormalized.includes('invoice_image_path = ?') && sqlNormalized.includes('stage2_edit_count = ?')) {
        // Stage 2 re-upload (with edit count and reupload times)
        db.orders[idx].invoice_image_path = params[0];
        db.orders[idx].stage2_edit_count = parseInt(params[1]);
        db.orders[idx].stage2_reupload_times = params[2] || '[]';
      } else if (sqlNormalized.includes('invoice_image_path = ?') && sqlNormalized.includes('stage3_opened_at = ?')) {
        // Stage 2 initial completion with stage 3 opened time
        db.orders[idx].invoice_image_path = params[0];
        db.orders[idx].stage2_completed_at = params[1];
        db.orders[idx].stage3_opened_at = params[2];
        db.orders[idx].status = params[3];
      } else if (sqlNormalized.includes('invoice_image_path = ?') && sqlNormalized.includes('stage2_completed_at = ?')) {
        // Stage 2 completion
        db.orders[idx].invoice_image_path = params[0];
        db.orders[idx].stage2_completed_at = params[1];
        db.orders[idx].status = params[2];
      } else if (sqlNormalized.includes('tracking_id = ?') && sqlNormalized.includes('stage3_edit_count = ?')) {
        // Stage 3 re-upload (with edit count and reupload times)
        db.orders[idx].tracking_id = params[0];
        db.orders[idx].stage3_edit_count = parseInt(params[1]);
        db.orders[idx].stage3_reupload_times = params[2] || '[]';
      } else if (sqlNormalized.includes('tracking_id = ?') && sqlNormalized.includes('stage3_completed_at = ?')) {
        // Stage 3 completion
        db.orders[idx].tracking_id = params[0];
        db.orders[idx].stage3_completed_at = params[1];
        db.orders[idx].status = params[2];
      }
      writeMockDb(db);
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  // DELETE FROM orders
  if (sqlNormalized.startsWith('delete from orders')) {
    const orderId = parseInt(params[0]);
    const originalLength = db.orders.length;
    db.orders = db.orders.filter(o => o.id !== orderId);
    if (db.orders.length < originalLength) {
      writeMockDb(db);
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  // UPDATE permission_scopes
  if (sqlNormalized.startsWith('update permission_scopes')) {
    if (!db.permission_scopes) db.permission_scopes = [];
    const scopeId = parseInt(params[params.length - 1]);
    const idx = db.permission_scopes.findIndex(s => s.id === scopeId);
    if (idx !== -1) {
      db.permission_scopes[idx].name = params[0];
      db.permission_scopes[idx].permissions = typeof params[1] === 'string' ? JSON.parse(params[1]) : params[1];
      writeMockDb(db);
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  // DELETE FROM permission_scopes
  if (sqlNormalized.startsWith('delete from permission_scopes')) {
    if (!db.permission_scopes) db.permission_scopes = [];
    const scopeId = parseInt(params[0]);
    const originalLength = db.permission_scopes.length;
    db.permission_scopes = db.permission_scopes.filter(s => s.id !== scopeId);
    if (db.permission_scopes.length < originalLength) {
      writeMockDb(db);
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  // DELETE FROM users
  if (sqlNormalized.startsWith('delete from users')) {
    const userId = parseInt(params[0], 10);
    const originalLength = db.users.length;
    db.users = db.users.filter(u => parseInt(u.id, 10) !== userId);
    if (db.users.length < originalLength) {
      writeMockDb(db);
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  // UPDATE users
  if (sqlNormalized.startsWith('update users')) {
    const userId = parseInt(params[params.length - 1]);
    const idx = db.users.findIndex(u => u.id === userId);
    if (idx !== -1) {
      let pIdx = 0;
      if (sqlNormalized.includes('name = ?')) {
        db.users[idx].name = params[pIdx++];
      }
      if (sqlNormalized.includes('email = ?')) {
        db.users[idx].email = params[pIdx++];
      }
      if (sqlNormalized.includes('password = ?')) {
        db.users[idx].password = params[pIdx++];
      }
      if (sqlNormalized.includes('role = ?')) {
        db.users[idx].role = params[pIdx++];
      }
      if (sqlNormalized.includes('designation = ?')) {
        db.users[idx].designation = params[pIdx++];
      }
      if (sqlNormalized.includes('permission_scopes = ?')) {
        db.users[idx].permission_scopes = params[pIdx++];
      }
      writeMockDb(db);
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  // DELETE FROM order_types
  if (sqlNormalized.startsWith('delete from order_types')) {
    if (!db.order_types) db.order_types = [];
    const typeId = parseInt(params[0]);
    const originalLength = db.order_types.length;
    db.order_types = db.order_types.filter(t => t.id !== typeId);
    if (db.order_types.length < originalLength) {
      writeMockDb(db);
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  // DELETE FROM users
  if (sqlNormalized.startsWith('delete from users')) {
    const userId = parseInt(params[0]);
    const originalLength = db.users.length;
    db.users = db.users.filter(u => u.id !== userId);
    if (db.users.length < originalLength) {
      writeMockDb(db);
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  // UPDATE clients
  if (sqlNormalized.startsWith('update clients')) {
    const clientId = parseInt(params[params.length - 1]);
    const idx = db.clients.findIndex(c => c.id === clientId);
    if (idx !== -1) {
      db.clients[idx].name = params[0];
      db.clients[idx].email = params[1];
      db.clients[idx].phone = params[2];
      db.clients[idx].address = params[3];
      writeMockDb(db);
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  // UPDATE settings
  if (sqlNormalized.startsWith('update settings')) {
    if (!db.settings) db.settings = [];
    const idx = db.settings.findIndex(s => s.id === 1);

    if (sqlNormalized.includes('refilling_order_types = ?')) {
      if (idx !== -1) {
        db.settings[idx].refilling_order_types = params[0];
      } else {
        db.settings.push({
          id: 1,
          app_name: 'ISS PORTAL',
          refilling_order_types: params[0]
        });
      }
      writeMockDb(db);
      return { affectedRows: 1 };
    }

    if (sqlNormalized.includes('refilling_automation_rules = ?')) {
      if (idx !== -1) {
        db.settings[idx].refilling_automation_rules = params[0];
      } else {
        db.settings.push({
          id: 1,
          app_name: 'ISS PORTAL',
          refilling_automation_rules: params[0]
        });
      }
      writeMockDb(db);
      return { affectedRows: 1 };
    }

    if (sqlNormalized.includes('smtp_host = ?')) {
      if (idx !== -1) {
        db.settings[idx].smtp_host = params[0];
        db.settings[idx].smtp_port = parseInt(params[1] || '25');
        db.settings[idx].smtp_user = params[2];
        db.settings[idx].smtp_pass = params[3];
        db.settings[idx].smtp_secure = params[4] || 'none';
        db.settings[idx].smtp_sender_name = params[5];
        db.settings[idx].smtp_sender_email = params[6];
      } else {
        db.settings.push({
          id: 1,
          smtp_host: params[0],
          smtp_port: parseInt(params[1] || '25'),
          smtp_user: params[2],
          smtp_pass: params[3],
          smtp_secure: params[4] || 'none',
          smtp_sender_name: params[5],
          smtp_sender_email: params[6]
        });
      }
      writeMockDb(db);
      return { affectedRows: 1 };
    }

    if (idx !== -1) {
      db.settings[idx].app_name = params[0];
      db.settings[idx].app_logo = params[1];
      db.settings[idx].favicon = params[2];
      db.settings[idx].logo_width = parseInt(params[3] || '150');
      db.settings[idx].reupload_buffer_time = parseInt(params[4] || '20');
      db.settings[idx].max_reupload_count = parseInt(params[5] || '3');
    } else {
      db.settings.push({
        id: 1,
        app_name: params[0],
        app_logo: params[1],
        favicon: params[2],
        logo_width: parseInt(params[3] || '150'),
        reupload_buffer_time: parseInt(params[4] || '20'),
        max_reupload_count: parseInt(params[5] || '3')
      });
    }
    writeMockDb(db);
    return { affectedRows: 1 };
  }


  // UPDATE email_templates
  if (sqlNormalized.startsWith('update email_templates')) {
    if (!db.email_templates) db.email_templates = [];
    if (sqlNormalized.includes('notify_admin')) {
      const templateKey = params[6];
      const idx = db.email_templates.findIndex(t => t.template_key === templateKey);
      if (idx !== -1) {
        db.email_templates[idx].subject = params[0];
        db.email_templates[idx].body = params[1];
        db.email_templates[idx].notify_admin = parseInt(params[2]);
        db.email_templates[idx].notify_staff_1 = parseInt(params[3]);
        db.email_templates[idx].notify_staff_2 = parseInt(params[4]);
        db.email_templates[idx].notify_staff_3 = parseInt(params[5]);
        writeMockDb(db);
        return { affectedRows: 1 };
      }
    } else {
      const templateKey = params[2];
      const idx = db.email_templates.findIndex(t => t.template_key === templateKey);
      if (idx !== -1) {
        db.email_templates[idx].subject = params[0];
        db.email_templates[idx].body = params[1];
        writeMockDb(db);
        return { affectedRows: 1 };
      }
    }
    return { affectedRows: 0 };
  }

  // DELETE FROM clients
  if (sqlNormalized.startsWith('delete from clients')) {
    const clientId = parseInt(params[0]);
    const originalLength = db.clients.length;
    db.clients = db.clients.filter(c => c.id !== clientId);
    if (db.clients.length < originalLength) {
      writeMockDb(db);
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  return [];
}
