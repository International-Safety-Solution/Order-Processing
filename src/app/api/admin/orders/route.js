import { query } from '@/lib/db';
import { getSession, getUserPermissions } from '@/lib/auth';
import { getKarachiDate } from '@/lib/dateUtils';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const permissions = await getUserPermissions(session);
  if (session.role !== 'ADMIN' && !permissions?.order_processing?.view) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    // MySQL query with JOINs
    let orders;
    if (process.env.DB_HOST) {
      orders = await query(`
        SELECT 
          o.*,
          COALESCE(c.name, 'Deleted Client') as client_name,
          COALESCE(c.phone, '') as client_phone,
          COALESCE(c.address, '') as client_address,
          COALESCE(ot.name, 'Standard Order') as order_type_name,
          COALESCE(u1.name, 'Unassigned / Deleted Staff') as staff_1_name,
          COALESCE(u2.name, 'Unassigned / Deleted Staff') as staff_2_name,
          COALESCE(u3.name, 'Unassigned / Deleted Staff') as staff_3_name,
          COALESCE(uc.name, 'System') as created_by_name
        FROM orders o
        LEFT JOIN clients c ON o.client_id = c.id
        LEFT JOIN order_types ot ON o.order_type_id = ot.id
        LEFT JOIN users u1 ON o.assigned_staff_1_id = u1.id
        LEFT JOIN users u2 ON o.assigned_staff_2_id = u2.id
        LEFT JOIN users u3 ON o.assigned_staff_3_id = u3.id
        LEFT JOIN users uc ON o.created_by_id = uc.id
        ORDER BY o.id ASC
      `);
    } else {
      // JSON mock database fallback handles joining inside lib/db.js query helper
      orders = await query('SELECT * FROM orders');
      if (Array.isArray(orders)) {
        orders.sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
      }
    }

    return Response.json(orders);
  } catch (error) {
    console.error('Fetch orders error:', error);
    return Response.json({ error: 'Failed to retrieve orders' }, { status: 500 });
  }
}


export async function POST(request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const permissions = await getUserPermissions(session);
  if (session.role !== 'ADMIN' && !permissions?.order_processing?.create) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { clientId, orderTypeId, details, qty, deadlineDate, staff1Id, staff2Id, staff3Id, poNo, poFilePath } = await request.json();

    if (!clientId || !orderTypeId || !details || !deadlineDate || !staff1Id || !staff2Id || !staff3Id) {
      return Response.json({ error: 'All mandatory fields (Client, Order Type, Details, Deadline Date, and Staff Crew) are required.' }, { status: 400 });
    }

    // Calculate lowest available sequential order ID (gap-filling logic)
    // If order #1, #2, #3 exist and #2 is deleted, next order takes #2.
    // If #1, #2 exist, next order takes #3.
    const existingOrders = await query('SELECT id FROM orders ORDER BY id ASC');
    const existingIds = new Set((existingOrders || []).map(o => o.id));
    let nextOrderId = 1;
    while (existingIds.has(nextOrderId)) {
      nextOrderId++;
    }

    const currentPKTDate = getKarachiDate();

    // Insert order in Pending Task status with creator ID, stage1_opened_at, and assigned sequential ID
    await query(
      'INSERT INTO orders (id, client_id, order_type_id, details, qty, deadline_date, status, assigned_staff_1_id, assigned_staff_2_id, assigned_staff_3_id, po_no, po_file_path, created_by_id, stage1_opened_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        nextOrderId,
        parseInt(clientId),
        orderTypeId ? parseInt(orderTypeId) : null,
        details,
        qty ? parseInt(qty) : null,
        deadlineDate || null,
        'PENDING_TASK', // Initial status
        parseInt(staff1Id),
        parseInt(staff2Id),
        parseInt(staff3Id),
        poNo || null,
        poFilePath || null,
        session.id,
        currentPKTDate
      ]
    );

    const clientRows = await query('SELECT name FROM clients WHERE id = ?', [parseInt(clientId)]);
    const clientName = clientRows && clientRows.length > 0 ? clientRows[0].name : '';
    
    let orderTypeName = '';
    if (orderTypeId) {
      const typeRows = await query('SELECT name FROM order_types WHERE id = ?', [parseInt(orderTypeId)]);
      if (typeRows && typeRows.length > 0) {
        orderTypeName = typeRows[0].name;
      }
    }

    // Fire email notification asynchronously
    const { sendSystemEmail } = require('@/lib/mailer');
    sendSystemEmail('order_created', {
      order_id: nextOrderId,
      client_name: clientName,
      order_type: orderTypeName || 'Standard Order',
      qty: qty ? String(qty) : 'N/A',
      po_no: poNo || 'N/A',
      deadline_date: deadlineDate || 'N/A',
      assigned_staff_1_id: parseInt(staff1Id),
      assigned_staff_2_id: parseInt(staff2Id),
      assigned_staff_3_id: parseInt(staff3Id)
    }).catch(err => {
      console.error('Failed to trigger order_created system notification:', err);
    });

    return Response.json({
      success: true,
      message: 'Order created and assigned successfully',
      orderId: nextOrderId
    });
  } catch (error) {
    console.error('Create order error:', error);
    return Response.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
