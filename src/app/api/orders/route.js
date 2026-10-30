import { query } from '@/lib/db';
import { getSession, getUserPermissions } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'STAFF') {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = session;
  const permissions = await getUserPermissions(session);

  if (!permissions) {
    return Response.json([]);
  }

  try {
    let orders;
    
    // Check which phases are active for this user
    const conditions = [];
    const queryParams = [];
    
    if (permissions.phases?.production) {
      conditions.push('o.assigned_staff_1_id = ?');
      queryParams.push(id);
    }
    if (permissions.phases?.accounts) {
      conditions.push('o.assigned_staff_2_id = ?');
      queryParams.push(id);
    }
    if (permissions.phases?.logistics) {
      conditions.push('o.assigned_staff_3_id = ?');
      queryParams.push(id);
    }

    if (conditions.length === 0) {
      return Response.json([]);
    }

    if (process.env.DB_HOST) {
      const sql = `
        SELECT 
          o.*, 
          COALESCE(c.name, 'Deleted Client') as client_name, 
          COALESCE(c.phone, '') as client_phone, 
          COALESCE(c.address, '') as client_address, 
          COALESCE(uc.name, 'System') as created_by_name
        FROM orders o
        LEFT JOIN clients c ON o.client_id = c.id
        LEFT JOIN users uc ON o.created_by_id = uc.id
        WHERE (${conditions.join(' OR ')})
        ORDER BY o.id DESC
      `;
      orders = await query(sql, queryParams);
    } else {
      // JSON mock DB fallback
      orders = await query('SELECT * FROM orders');
      orders = orders.filter(o => {
        return (
          (permissions.phases?.production && o.assigned_staff_1_id === id) ||
          (permissions.phases?.accounts && o.assigned_staff_2_id === id) ||
          (permissions.phases?.logistics && o.assigned_staff_3_id === id)
        );
      });
    }

    return Response.json(orders);
  } catch (error) {
    console.error('Fetch staff orders error:', error);
    return Response.json({ error: 'Failed to retrieve orders' }, { status: 500 });
  }
}
