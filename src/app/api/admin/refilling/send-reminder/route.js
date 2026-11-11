import { query } from '@/lib/db';
import { getSession, getUserPermissions } from '@/lib/auth';
import { sendSystemEmail } from '@/lib/mailer';
import { getKarachiDateObj } from '@/lib/dateUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const permissions = await getUserPermissions(session);
  if (session.role !== 'ADMIN' && !permissions?.order_processing?.view) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { orderIds } = await request.json();

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return Response.json({ error: 'orderIds must be a non-empty array' }, { status: 400 });
    }

    const cleanedOrderIds = orderIds.map(id => Number(id)).filter(id => !isNaN(id) && id > 0);
    if (cleanedOrderIds.length === 0) {
      return Response.json({ error: 'No valid order IDs provided' }, { status: 400 });
    }

    // 1. Fetch SMTP settings to verify configuration
    const settingsRows = await query('SELECT * FROM settings WHERE id = 1');
    const settings = settingsRows && settingsRows.length > 0 ? settingsRows[0] : {};
    const host = settings.smtp_host || process.env.SMTP_HOST || '';
    const senderEmail = settings.smtp_sender_email || process.env.SMTP_SENDER_EMAIL || settings.smtp_user || '';
    const isSmtpConfigured = Boolean(host && senderEmail);

    // 2. Fetch orders from database
    let rawOrders = [];
    if (process.env.DB_HOST) {
      const placeholders = cleanedOrderIds.map(() => '?').join(',');
      rawOrders = await query(`
        SELECT 
          o.*,
          COALESCE(c.name, 'Unknown Client') as client_name,
          COALESCE(c.email, '') as client_email,
          COALESCE(c.phone, '') as client_phone,
          COALESCE(ot.name, 'Standard Order') as order_type_name
        FROM orders o
        LEFT JOIN clients c ON o.client_id = c.id
        LEFT JOIN order_types ot ON o.order_type_id = ot.id
        WHERE o.id IN (${placeholders})
      `, cleanedOrderIds);
    } else {
      const allOrders = await query('SELECT * FROM orders');
      rawOrders = allOrders.filter(o => cleanedOrderIds.includes(Number(o.id)));
    }

    if (!Array.isArray(rawOrders) || rawOrders.length === 0) {
      return Response.json({ error: 'No matching orders found' }, { status: 404 });
    }

    const nowInPkt = getKarachiDateObj();
    const startOfToday = new Date(nowInPkt.getFullYear(), nowInPkt.getMonth(), nowInPkt.getDate());

    const results = [];
    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const order of rawOrders) {
      const orderDate = order.created_at ? new Date(order.created_at) : new Date();
      const expiryDate = new Date(orderDate);
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      expiryDate.setDate(expiryDate.getDate() - 1);

      const expiryDayOnly = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate());
      const diffMs = expiryDayOnly.getTime() - startOfToday.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      // Format date helper: DD/MM/YYYY
      const formatDisplayDate = (d) => {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      };

      const clientEmail = (order.client_email || '').trim();
      const clientName = order.client_name || 'Client';

      // Validation 1: Check if client has a registered email address
      if (!clientEmail || !clientEmail.includes('@')) {
        skippedCount++;
        results.push({
          orderId: order.id,
          clientName,
          email: clientEmail || null,
          status: 'SKIPPED',
          error: 'is client ki email available nahi hai'
        });
        continue;
      }

      // Validation 2: Check if SMTP is configured before attempting send
      if (!isSmtpConfigured) {
        failedCount++;
        results.push({
          orderId: order.id,
          clientName,
          email: clientEmail,
          status: 'FAILED',
          error: 'SMTP server is not configured in Settings -> Integration'
        });
        continue;
      }

      // Determine alert badge text
      let alertBadge = '🟢 Safe (> 30 Days Remaining)';
      if (diffDays <= 5) {
        alertBadge = '🔴 Critical Expiry (≤ 5 Days Remaining)';
      } else if (diffDays <= 15) {
        alertBadge = '🟤 15-Day Warning (6 - 15 Days Remaining)';
      } else if (diffDays <= 30) {
        alertBadge = '🟡 30-Day Notice (16 - 30 Days Remaining)';
      }

      // Specific scenario text for Refilling vs New Fire Extinguisher purchases
      const orderTypeName = order.order_type_name || 'Fire Extinguisher Service';
      const isRefillingOrder = orderTypeName.toLowerCase().includes('refill');
      const scenarioText = isRefillingOrder
        ? 'Your fire safety equipment was previously refilled on ' + formatDisplayDate(orderDate) + ' and is now approaching its next mandatory annual refilling and inspection cycle.'
        : 'Your fire extinguishers deployed / supplied on ' + formatDisplayDate(orderDate) + ' are now reaching the end of their first-year certification and require mandatory annual inspection and refilling.';

      const templateParams = {
        client_name: clientName,
        order_id: String(order.id),
        order_type: orderTypeName,
        qty: order.qty != null ? String(order.qty) : '-',
        order_date: formatDisplayDate(orderDate),
        expiry_date: formatDisplayDate(expiryDate),
        days_left: String(diffDays),
        alert_badge: alertBadge,
        scenario_text: scenarioText,
        direct_recipient: clientEmail,
        portal_url: process.env.FRONTEND_URL || 'https://order.internationalsafetysolution.com'
      };

      try {
        const mailResult = await sendSystemEmail('refilling_reminder', templateParams);
        if (mailResult && mailResult.success === true && mailResult.sentRecipients?.length > 0) {
          sentCount++;
          results.push({
            orderId: order.id,
            clientName,
            email: clientEmail,
            status: 'SENT',
            message: 'Email reminder sent successfully'
          });
        } else {
          failedCount++;
          results.push({
            orderId: order.id,
            clientName,
            email: clientEmail,
            status: 'FAILED',
            error: (mailResult && (mailResult.error || mailResult.failedRecipients?.[0]?.error)) || 'SMTP delivery failed'
          });
        }
      } catch (mailErr) {
        failedCount++;
        results.push({
          orderId: order.id,
          clientName,
          email: clientEmail,
          status: 'FAILED',
          error: mailErr.message || 'Error executing email dispatcher'
        });
      }
    }

    return Response.json({
      success: sentCount > 0,
      smtpConfigured: isSmtpConfigured,
      totalProcessed: rawOrders.length,
      sentCount,
      skippedCount,
      failedCount,
      results
    });
  } catch (error) {
    console.error('Send reminder error:', error);
    return Response.json({ error: 'Failed to dispatch refilling reminder emails' }, { status: 500 });
  }
}

