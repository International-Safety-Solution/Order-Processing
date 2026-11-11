import { query } from '@/lib/db';
import { getSession, getUserPermissions } from '@/lib/auth';
import { sendSystemEmail } from '@/lib/mailer';
import { getKarachiDateObj } from '@/lib/dateUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const permissions = await getUserPermissions(session);
  if (session.role !== 'ADMIN' && !permissions?.order_processing?.view) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    // 1. Fetch settings for refilling_order_types, refilling_automation_rules, and SMTP configuration
    const settingsRows = await query('SELECT * FROM settings WHERE id = 1');
    const settings = settingsRows && settingsRows.length > 0 ? settingsRows[0] : {};
    const host = settings.smtp_host || process.env.SMTP_HOST || '';
    const senderEmail = settings.smtp_sender_email || process.env.SMTP_SENDER_EMAIL || settings.smtp_user || '';
    const isSmtpConfigured = Boolean(host && senderEmail);

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

    if (automationRules.length === 0) {
      return Response.json({
        success: false,
        message: 'No active automation rules configured. Please select at least one alert level in Automation Settings.'
      }, { status: 400 });
    }

    // 2. Fetch all matching orders
    let rawOrders = [];
    if (process.env.DB_HOST) {
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
        ORDER BY o.id ASC
      `);
    } else {
      rawOrders = await query('SELECT * FROM orders');
    }

    // Filter by configured order types
    const matchingOrders = rawOrders.filter(order => selectedTypeIds.includes(Number(order.order_type_id)));

    // 3. Filter orders matching configured alert rules
    const nowInPkt = getKarachiDateObj();
    const startOfToday = new Date(nowInPkt.getFullYear(), nowInPkt.getMonth(), nowInPkt.getDate());

    const eligibleOrders = [];
    for (const order of matchingOrders) {
      const orderDate = order.created_at ? new Date(order.created_at) : new Date();
      const expiryDate = new Date(orderDate);
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      expiryDate.setDate(expiryDate.getDate() - 1);

      const expiryDayOnly = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate());
      const diffMs = expiryDayOnly.getTime() - startOfToday.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      let alertLevel = 'SAFE';
      if (diffDays <= 5) {
        alertLevel = 'CRITICAL';
      } else if (diffDays <= 15) {
        alertLevel = 'WARNING';
      } else if (diffDays <= 30) {
        alertLevel = 'APPROACHING';
      }

      if (automationRules.includes(alertLevel)) {
        eligibleOrders.push({
          ...order,
          orderDate,
          expiryDate,
          diffDays,
          alertLevel
        });
      }
    }

    if (eligibleOrders.length === 0) {
      return Response.json({
        success: true,
        message: 'No orders currently match the configured automation alert criteria.',
        totalProcessed: 0,
        sentCount: 0,
        skippedCount: 0,
        results: []
      });
    }

    // 4. Send emails to eligible orders
    const results = [];
    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    const formatDisplayDate = (d) => {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    for (const order of eligibleOrders) {
      const clientEmail = (order.client_email || '').trim();
      const clientName = order.client_name || 'Client';

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

      // Check if SMTP is configured
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

      let alertBadge = '🟢 Safe (> 30 Days Remaining)';
      if (order.alertLevel === 'CRITICAL') {
        alertBadge = '🔴 Critical Expiry (≤ 5 Days Remaining)';
      } else if (order.alertLevel === 'WARNING') {
        alertBadge = '🟤 15-Day Warning (6 - 15 Days Remaining)';
      } else if (order.alertLevel === 'APPROACHING') {
        alertBadge = '🟡 30-Day Notice (16 - 30 Days Remaining)';
      }

      const orderTypeName = order.order_type_name || 'Fire Extinguisher Service';
      const isRefillingOrder = orderTypeName.toLowerCase().includes('refill');
      const scenarioText = isRefillingOrder
        ? 'Your fire safety equipment was previously refilled on ' + formatDisplayDate(order.orderDate) + ' and is now approaching its next mandatory annual refilling and inspection cycle.'
        : 'Your fire extinguishers deployed / supplied on ' + formatDisplayDate(order.orderDate) + ' are now reaching the end of their first-year certification and require mandatory annual inspection and refilling.';

      const templateParams = {
        client_name: clientName,
        order_id: String(order.id),
        order_type: orderTypeName,
        qty: order.qty != null ? String(order.qty) : '-',
        order_date: formatDisplayDate(order.orderDate),
        expiry_date: formatDisplayDate(order.expiryDate),
        days_left: String(order.diffDays),
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
            message: 'Automated email dispatched successfully'
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
      } catch (err) {
        failedCount++;
        results.push({
          orderId: order.id,
          clientName,
          email: clientEmail,
          status: 'FAILED',
          error: err.message
        });
      }
    }

    return Response.json({
      success: sentCount > 0,
      smtpConfigured: isSmtpConfigured,
      message: `Automation executed: ${sentCount} email(s) sent, ${skippedCount} skipped, ${failedCount} failed.`,
      totalProcessed: eligibleOrders.length,
      sentCount,
      skippedCount,
      failedCount,
      results
    });
  } catch (error) {
    console.error('Run automation error:', error);
    return Response.json({ error: 'Failed to run email automation' }, { status: 500 });
  }
}

