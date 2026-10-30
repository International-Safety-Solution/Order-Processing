import { query } from '@/lib/db';
import { getSession, getUserPermissions } from '@/lib/auth';

export async function PUT(request, context) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const permissions = await getUserPermissions(session);
  if (session.role !== 'ADMIN' && !permissions?.order_types?.edit) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await context.params;
  const typeId = parseInt(id);

  try {
    const { name } = await request.json();
    if (!name || !name.trim()) {
      return Response.json({ error: 'Order Type Name is required' }, { status: 400 });
    }

    await query('UPDATE order_types SET name = ? WHERE id = ?', [name.trim(), typeId]);
    return Response.json({ success: true, message: 'Order Type updated successfully' });
  } catch (error) {
    console.error('Failed to update order type:', error);
    if (error.message && error.message.includes('Duplicate entry')) {
      return Response.json({ error: 'This Order Type name already exists' }, { status: 400 });
    }
    return Response.json({ error: 'Failed to update order type' }, { status: 500 });
  }
}

export async function DELETE(request, context) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const permissions = await getUserPermissions(session);
  if (session.role !== 'ADMIN' && !permissions?.order_types?.delete) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await context.params;
  const typeId = parseInt(id);

  try {
    // Foreign key safety pre-check: ensure order type is not used by existing orders
    const linkedOrders = await query('SELECT id FROM orders WHERE order_type_id = ? LIMIT 1', [typeId]);
    if (linkedOrders && linkedOrders.length > 0) {
      return Response.json({
        error: 'Cannot delete order type: There are existing orders configured with this order type.'
      }, { status: 400 });
    }

    await query('DELETE FROM order_types WHERE id = ?', [typeId]);
    return Response.json({ success: true, message: 'Order Type deleted successfully' });
  } catch (error) {
    console.error('Failed to delete order type:', error);
    return Response.json({ error: 'Failed to delete order type' }, { status: 500 });
  }
}
