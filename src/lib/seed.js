import { query } from './db.js';

export async function seedDatabase() {
  if (!process.env.DB_HOST) {
    console.log('Skipping MySQL seeding: No DB_HOST found in env. App is using local JSON database.');
    return;
  }

  console.log('Initializing MySQL table checks/creation...');
  try {
    // Create users table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        designation VARCHAR(100) NULL,
        must_change_password TINYINT NOT NULL DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    try {
      await query('ALTER TABLE users ADD COLUMN must_change_password TINYINT NOT NULL DEFAULT 0');
    } catch (e) {}

    // Create clients table
    await query(`
      CREATE TABLE IF NOT EXISTS clients (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(100) NOT NULL,
        address TEXT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Create order_types table
    await query(`
      CREATE TABLE IF NOT EXISTS order_types (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Create orders table
    await query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        client_id INT NOT NULL,
        order_type_id INT NULL,
        details TEXT NOT NULL,
        qty INT NULL,
        deadline_date VARCHAR(100) NULL,
        status VARCHAR(100) NOT NULL,
        assigned_staff_1_id INT NOT NULL,
        assigned_staff_2_id INT NOT NULL,
        assigned_staff_3_id INT NOT NULL,
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
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
        FOREIGN KEY (order_type_id) REFERENCES order_types(id) ON DELETE SET NULL,
        FOREIGN KEY (assigned_staff_1_id) REFERENCES users(id),
        FOREIGN KEY (assigned_staff_2_id) REFERENCES users(id),
        FOREIGN KEY (assigned_staff_3_id) REFERENCES users(id),
        FOREIGN KEY (created_by_id) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Ensure columns exist on existing databases
    try {
      await query('ALTER TABLE orders ADD COLUMN order_type_id INT NULL');
      console.log('Added "order_type_id" column to orders table.');
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      await query('ALTER TABLE orders ADD COLUMN qty INT NULL');
      console.log('Added "qty" column to orders table.');
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      await query('ALTER TABLE orders ADD COLUMN deadline_date VARCHAR(100) NULL');
      console.log('Added "deadline_date" column to orders table.');
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      await query('ALTER TABLE orders ADD COLUMN received_by VARCHAR(255) NULL');
      console.log('Added "received_by" column to orders table.');
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      await query('ALTER TABLE orders ADD COLUMN stage1_completed_at DATETIME NULL');
      console.log('Added "stage1_completed_at" column to orders.');
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      await query('ALTER TABLE orders ADD COLUMN stage2_completed_at DATETIME NULL');
      console.log('Added "stage2_completed_at" column to orders.');
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      await query('ALTER TABLE orders ADD COLUMN stage3_completed_at DATETIME NULL');
      console.log('Added "stage3_completed_at" column to orders.');
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      await query('ALTER TABLE orders ADD COLUMN po_no VARCHAR(255) NULL');
      console.log('Added "po_no" column to orders table.');
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      await query('ALTER TABLE orders ADD COLUMN po_file_path TEXT NULL');
      console.log('Added "po_file_path" column to orders table.');
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      await query('ALTER TABLE orders ADD COLUMN created_by_id INT NULL');
      console.log('Added "created_by_id" column to orders table.');
      await query('UPDATE orders SET created_by_id = 1 WHERE created_by_id IS NULL');
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      await query('ALTER TABLE orders ADD COLUMN stage1_edit_count INT DEFAULT 0');
      console.log('Added "stage1_edit_count" column to orders.');
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      await query('ALTER TABLE orders ADD COLUMN stage2_edit_count INT DEFAULT 0');
      console.log('Added "stage2_edit_count" column to orders.');
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      await query('ALTER TABLE orders ADD COLUMN stage3_edit_count INT DEFAULT 0');
      console.log('Added "stage3_edit_count" column to orders.');
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      await query('ALTER TABLE orders ADD COLUMN stage1_opened_at DATETIME NULL');
      console.log('Added "stage1_opened_at" column to orders.');
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      await query('ALTER TABLE orders ADD COLUMN stage2_opened_at DATETIME NULL');
      console.log('Added "stage2_opened_at" column to orders.');
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      await query('ALTER TABLE orders ADD COLUMN stage3_opened_at DATETIME NULL');
      console.log('Added "stage3_opened_at" column to orders.');
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      await query('ALTER TABLE orders ADD COLUMN stage1_reupload_times TEXT NULL');
      console.log('Added "stage1_reupload_times" column to orders.');
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      await query('ALTER TABLE orders ADD COLUMN stage2_reupload_times TEXT NULL');
      console.log('Added "stage2_reupload_times" column to orders.');
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      await query('ALTER TABLE orders ADD COLUMN stage3_reupload_times TEXT NULL');
      console.log('Added "stage3_reupload_times" column to orders.');
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      await query('ALTER TABLE orders ADD COLUMN stage1_upload_history TEXT NULL');
      console.log('Added "stage1_upload_history" column to orders.');
    } catch (e) {
      // Column already exists, ignore
    }

    // Retroactively seed timestamps for already completed stages in MySQL
    try {
      await query("UPDATE orders SET stage1_completed_at = created_at WHERE dc_image_path IS NOT NULL AND stage1_completed_at IS NULL");
      await query("UPDATE orders SET stage2_completed_at = updated_at WHERE invoice_image_path IS NOT NULL AND stage2_completed_at IS NULL");
      await query("UPDATE orders SET stage3_completed_at = updated_at WHERE tracking_id IS NOT NULL AND stage3_completed_at IS NULL");
      await query("UPDATE orders SET stage1_opened_at = created_at WHERE stage1_opened_at IS NULL");
      console.log('Retroactively updated completion and open timestamps in MySQL.');
    } catch (e) {
      console.error('Failed to run retroactive updates:', e.message);
    }

    // Seed default admin if not exist
    const users = await query('SELECT COUNT(*) as count FROM users');
    if (users[0] && users[0].count === 0) {
      console.log('Database empty, seeding default admin account...');
      
      // Default Admin
      await query(
        'INSERT INTO users (email, password, name, role, designation) VALUES (?, ?, ?, ?, ?)',
        ['internationalsafetysolution@gmail.com', 'Admin@1236#', 'System Administrator', 'ADMIN', null]
      );
      // Seed mock clients
      await query(
        'INSERT INTO clients (name, email, phone, address) VALUES (?, ?, ?, ?)',
        ['Siddique Traders', 'siddique@trade.com', '0300-1234567', 'Lahore, Pakistan']
      );

      await query(
        'INSERT INTO clients (name, email, phone, address) VALUES (?, ?, ?, ?)',
        ['Apex Industries', 'info@apex.com', '0321-7654321', 'Karachi, Pakistan']
      );

      // Seed default order types
      await query('INSERT INTO order_types (name) VALUES (?)', ['Refilling Service']);
      await query('INSERT INTO order_types (name) VALUES (?)', ['Installation Project']);
      await query('INSERT INTO order_types (name) VALUES (?)', ['Maintenance Request']);

      console.log('MySQL Database successfully seeded with default accounts, clients, and order types.');
    } else {
      console.log('MySQL Database already contains records. Seeding skipped.');
    }
  } catch (error) {
    console.error('Failed to seed MySQL database:', error.message);
  }
}
