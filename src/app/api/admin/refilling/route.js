import { query } from '@/lib/db';
import { getSession, getUserPermissions } from '@/lib/auth';
import { getKarachiDateObj } from '@/lib/dateUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const permissions = await getUserPermissions(session);
  if (session.role !== 'ADMIN' && !permissions?.order_processing?.view) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    // 1. Fetch settings to get configured refilling_order_types and refilling_automation_rules
    const settingsRows = await query('SELECT * FROM settings WHERE id = 1');
    const settings = settingsRows && settingsRows.length > 0 ? settingsRows[0] : {};
    let selectedTypeIds = [];
    if (settings.refilling_order_types) {
      try {
        selectedTypeIds = typeof settings.refilling_order_types === 'string'
          ? JSON.parse(settings.refilling_order_types)
          : settings.refilling_order_types;
      } catch (e) {
        selectedTypeIds = [];
      }
    }
    if (!Array.isArray(selectedTypeIds)) {
      selectedTypeIds = [];
    }
    // Convert to numbers for reliable comparison
    selectedTypeIds = selectedTypeIds.map(id => Number(id)).filter(id => !isNaN(id) && id > 0);

    let automationRules = [];
    if (settings.refilling_automation_rules) {
      try {
        automationRules = typeof settings.refilling_automation_rules === 'string'
          ? JSON.parse(settings.refilling_automation_rules)
          : settings.refilling_automation_rules;
      } catch (e) {
        automationRules = [];
      }
    }
    if (!Array.isArray(automationRules)) {
      automationRules = [];
    }

    // 2. Fetch all order types for configuration modal
    let allOrderTypes = [];
    try {
      allOrderTypes = await query('SELECT id, name FROM order_types ORDER BY id ASC');
      if (!Array.isArray(allOrderTypes)) allOrderTypes = [];
    } catch (e) {
      console.error('Error fetching order types:', e);
    }

    // 3. Fetch all orders (completed and incomplete)
    let rawOrders = [];
    if (process.env.DB_HOST) {
      rawOrders = await query(`
        SELECT 
          o.*,
          COALESCE(c.name, 'Deleted Client') as client_name,
          COALESCE(c.phone, '') as client_phone,
          COALESCE(c.address, '') as client_address,
          COALESCE(c.email, '') as client_email,
          COALESCE(ot.name, 'Standard Order') as order_type_name
        FROM orders o
        LEFT JOIN clients c ON o.client_id = c.id
        LEFT JOIN order_types ot ON o.order_type_id = ot.id
        ORDER BY o.id ASC
      `);
    } else {
      rawOrders = await query('SELECT * FROM orders');
    }

    if (!Array.isArray(rawOrders)) {
      rawOrders = [];
    }

    // 4. Filter orders matching the selected order types
    const matchingOrders = rawOrders.filter(order => {
      const typeId = Number(order.order_type_id);
      return selectedTypeIds.includes(typeId);
    });

    // 5. Calculate 1-year expiry and alert metrics for each order
    const nowInPkt = getKarachiDateObj();
    const startOfToday = new Date(nowInPkt.getFullYear(), nowInPkt.getMonth(), nowInPkt.getDate());

    const processedOrders = matchingOrders.map(order => {
      // Order initiation date
      const orderDate = order.created_at ? new Date(order.created_at) : new Date();
      
      // Expiry Date: exactly 1 year later minus 1 day (e.g. 10/10/2026 -> 09/10/2027)
      const expiryDate = new Date(orderDate);
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      expiryDate.setDate(expiryDate.getDate() - 1);

      // Diff in calendar days
      const expiryDayOnly = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate());
      const diffMs = expiryDayOnly.getTime() - startOfToday.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      // Alert level determination:
      // <= 5 days (or expired): CRITICAL (Red alert with clock icon)
      // 6 to 15 days: WARNING (Yellow alert)
      // 16 to 30 days: APPROACHING (Green alert)
      // > 30 days: SAFE (Normal)
      let alertLevel = 'SAFE';
      if (diffDays <= 5) {
        alertLevel = 'CRITICAL';
      } else if (diffDays <= 15) {
        alertLevel = 'WARNING';
      } else if (diffDays <= 30) {
        alertLevel = 'APPROACHING';
      }

      return {
        id: order.id,
        client_name: order.client_name || 'N/A',
        client_email: order.client_email || '',
        client_phone: order.client_phone || '',
        client_address: order.client_address || '',
        order_type_id: order.order_type_id,
        order_type_name: order.order_type_name || 'Standard Order',
        qty: order.qty != null ? order.qty : '-',
        status: order.status || 'PENDING',
        details: order.details || '',
        order_date: orderDate.toISOString(),
        expiry_date: expiryDate.toISOString(),
        diff_days: diffDays,
        alert_level: alertLevel,
        is_expired: diffDays < 0
      };
    });

    // Sort by urgency: Most urgent (smallest diff_days) first
    processedOrders.sort((a, b) => a.diff_days - b.diff_days);

    // Calculate count badges
    const counts = {
      total: processedOrders.length,
      critical: processedOrders.filter(o => o.alert_level === 'CRITICAL').length,
      warning: processedOrders.filter(o => o.alert_level === 'WARNING').length,
      approaching: processedOrders.filter(o => o.alert_level === 'APPROACHING').length,
      safe: processedOrders.filter(o => o.alert_level === 'SAFE').length
    };

    return Response.json({
      selectedTypeIds,
      allOrderTypes,
      automationRules,
      orders: processedOrders,
      counts
    });
  } catch (error) {
    console.error('Refilling follow-up fetch error:', error);
    return Response.json({ error: 'Failed to fetch refilling follow-up data' }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const permissions = await getUserPermissions(session);
  if (session.role !== 'ADMIN' && !permissions?.order_processing?.edit && !permissions?.order_types?.edit) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    let updatedSelectedTypes = undefined;
    let updatedAutomationRules = undefined;

    // 1. Update orderTypeIds if provided
    if (body.orderTypeIds !== undefined) {
      if (!Array.isArray(body.orderTypeIds)) {
        return Response.json({ error: 'orderTypeIds must be an array of IDs' }, { status: 400 });
      }
      const cleanedIds = body.orderTypeIds.map(id => Number(id)).filter(id => !isNaN(id) && id > 0);
      const jsonStr = JSON.stringify(cleanedIds);
      await query('UPDATE settings SET refilling_order_types = ? WHERE id = 1', [jsonStr]);
      updatedSelectedTypes = cleanedIds;
    }

    // 2. Update automationRules if provided
    if (body.automationRules !== undefined) {
      if (!Array.isArray(body.automationRules)) {
        return Response.json({ error: 'automationRules must be an array' }, { status: 400 });
      }
      const validAlerts = ['CRITICAL', 'WARNING', 'APPROACHING'];
      const cleanedRules = body.automationRules.filter(r => validAlerts.includes(r));
      const jsonStr = JSON.stringify(cleanedRules);
      await query('UPDATE settings SET refilling_automation_rules = ? WHERE id = 1', [jsonStr]);
      updatedAutomationRules = cleanedRules;
    }

    return Response.json({
      success: true,
      message: 'Refilling configuration updated successfully',
      selectedTypeIds: updatedSelectedTypes,
      automationRules: updatedAutomationRules
    });
  } catch (error) {
    console.error('Refilling config save error:', error);
    return Response.json({ error: 'Failed to save refilling configuration' }, { status: 500 });
  }
}
