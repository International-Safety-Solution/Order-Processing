import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getKarachiDate, getKarachiDateObj, parsePKTDate, formatKarachiDate } from '@/lib/dateUtils';

export async function POST(request, context) {
  const session = await getSession();
  if (!session || session.role !== 'STAFF') {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  if (session.must_change_password) {
    return Response.json({ error: 'You must change your default password before performing any workflow actions.' }, { status: 403 });
  }

  const { id } = await context.params;
  const orderId = parseInt(id);

  try {
    const { action, value, receivedBy } = await request.json();
    const { designation, id: staffId } = session;

    // Fetch current order state to verify assignments
    const orders = await query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!orders || orders.length === 0) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }
    const order = orders[0];

    const currentPKTDate = getKarachiDate();

    // Fetch re-upload buffer time and max re-upload count settings
    const settingsRows = await query('SELECT reupload_buffer_time, max_reupload_count FROM settings WHERE id = 1');
    const bufferMinutes = settingsRows && settingsRows.length > 0 ? (settingsRows[0].reupload_buffer_time || 20) : 20;
    const bufferMs = bufferMinutes * 60 * 1000;
    // max_reupload_count: 0 = no re-uploads allowed, N = N re-uploads allowed; null/undefined = unlimited (legacy)
    const maxReuploadCount = settingsRows && settingsRows.length > 0 && settingsRows[0].max_reupload_count !== undefined
      ? parseInt(settingsRows[0].max_reupload_count)
      : 3;

    // Stage 1 DRAFT: Save DC without completing stage or starting countdown timer
    if (action === 'SAVE_DRAFT_DC') {
      if (designation !== 'TASK_COMPLETION' || Number(order.assigned_staff_1_id) !== Number(staffId)) {
        return Response.json({ error: 'Permission denied for this task stage' }, { status: 403 });
      }
      if (order.status !== 'PENDING_TASK') {
        return Response.json({ error: 'Only pending Stage 1 orders can be saved as draft' }, { status: 400 });
      }
      if (!value || !value.trim()) {
        return Response.json({ error: 'Delivery Challan image/file is required' }, { status: 400 });
      }

      // Merge new files with existing saved DC files
      const existingDcPaths = order.dc_image_path ? order.dc_image_path.split(',').map(s => s.trim()).filter(Boolean) : [];
      const newDcPaths = value.split(',').map(s => s.trim()).filter(Boolean);
      const combinedDcPaths = [...existingDcPaths, ...newDcPaths].join(',');

      const finalReceivedBy = (receivedBy && receivedBy.trim()) ? receivedBy.trim() : (order.received_by || '');
      if (!finalReceivedBy) {
        return Response.json({ error: 'Received By name is required' }, { status: 400 });
      }

      // Parse and append to upload history
      let uploadHistory = [];
      if (order.stage1_upload_history) {
        try {
          const parsed = JSON.parse(order.stage1_upload_history);
          if (Array.isArray(parsed)) uploadHistory = parsed;
        } catch (e) {
          uploadHistory = [];
        }
      }
      // Guarantee existing batches are sequentially numbered 1..N without skips
      uploadHistory.forEach((b, idx) => {
        b.batch = idx + 1;
      });
      uploadHistory.push({
        batch: uploadHistory.length + 1,
        timestamp: currentPKTDate,
        files: newDcPaths,
        received_by: finalReceivedBy,
        type: 'DRAFT'
      });

      await query(
        'UPDATE orders SET dc_image_path = ?, received_by = ?, stage1_upload_history = ? WHERE id = ?',
        [combinedDcPaths, finalReceivedBy, JSON.stringify(uploadHistory), orderId]
      );

      return Response.json({
        success: true,
        message: 'Delivery Challan saved as draft. You can upload remaining DCs later.',
        dc_image_path: combinedDcPaths
      });
    }

    // Stage 1: TASK_COMPLETION completes and uploads DC (or completes with previously saved DCs)
    if (action === 'COMPLETE_TASK_1') {
      if (designation !== 'TASK_COMPLETION' || Number(order.assigned_staff_1_id) !== Number(staffId)) {
        return Response.json({ error: 'Permission denied for this task stage' }, { status: 403 });
      }

      if (order.status === 'PENDING_TASK') {
        const existingDcPaths = order.dc_image_path ? order.dc_image_path.split(',').map(s => s.trim()).filter(Boolean) : [];
        const newDcPaths = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
        const allDcPaths = [...existingDcPaths, ...newDcPaths];

        if (allDcPaths.length === 0) {
          return Response.json({ error: 'Delivery Challan image/file is required' }, { status: 400 });
        }

        const finalReceivedBy = (receivedBy && receivedBy.trim()) ? receivedBy.trim() : (order.received_by || '');
        if (!finalReceivedBy) {
          return Response.json({ error: 'Received By name is required' }, { status: 400 });
        }

        // Update upload history
        let uploadHistory = [];
        if (order.stage1_upload_history) {
          try {
            const parsed = JSON.parse(order.stage1_upload_history);
            if (Array.isArray(parsed)) uploadHistory = parsed;
          } catch (e) {
            uploadHistory = [];
          }
        }
        // Guarantee existing batches are sequentially numbered 1..N without skips
        uploadHistory.forEach((b, idx) => {
          b.batch = idx + 1;
        });
        uploadHistory.push({
          batch: uploadHistory.length + 1,
          timestamp: currentPKTDate,
          files: newDcPaths.length > 0 ? newDcPaths : (existingDcPaths.length > 0 && uploadHistory.length === 0 ? existingDcPaths : []),
          received_by: finalReceivedBy,
          type: 'FINAL'
        });

        const combinedDcPaths = allDcPaths.join(',');
        const bufferOffset = maxReuploadCount === 0 ? 0 : bufferMs;
        const stage2OpenDateObj = new Date(parsePKTDate(currentPKTDate).getTime() + bufferOffset);
        const stage2OpenedAt = formatKarachiDate(stage2OpenDateObj);

        await query(
          'UPDATE orders SET dc_image_path = ?, received_by = ?, stage1_upload_history = ?, stage1_completed_at = ?, stage2_opened_at = ?, status = ? WHERE id = ?',
          [combinedDcPaths, finalReceivedBy, JSON.stringify(uploadHistory), currentPKTDate, stage2OpenedAt, 'PENDING_INVOICE', orderId]
        );

        // Fetch client and order type details for notifications
        const clientRows = await query('SELECT name FROM clients WHERE id = ?', [order.client_id]);
        const clientName = clientRows && clientRows.length > 0 ? clientRows[0].name : '';
        
        let orderTypeName = '';
        if (order.order_type_id) {
          const typeRows = await query('SELECT name FROM order_types WHERE id = ?', [order.order_type_id]);
          if (typeRows && typeRows.length > 0) {
            orderTypeName = typeRows[0].name;
          }
        }

        // Fire Stage 1 Completed notification asynchronously
        const { sendSystemEmail } = require('@/lib/mailer');
        sendSystemEmail('stage1_completed', {
          order_id: orderId,
          client_name: clientName,
          order_type: orderTypeName || 'Standard Order',
          qty: order.qty || '0',
          po_no: order.po_no || 'N/A',
          deadline_date: order.deadline_date || 'N/A',
          receiver_name: finalReceivedBy,
          assigned_staff_1_id: order.assigned_staff_1_id,
          assigned_staff_2_id: order.assigned_staff_2_id,
          assigned_staff_3_id: order.assigned_staff_3_id
        }).catch(err => {
          console.error('Failed to trigger stage1_completed notification:', err);
        });

        return Response.json({ success: true, message: 'Delivery Challan uploaded, stage 1 completed.' });
      } else if (order.status === 'PENDING_INVOICE') {
        // Re-upload within buffer window check
        const elapsed = Date.now() - parsePKTDate(order.stage1_completed_at).getTime();
        if (elapsed >= bufferMs) {
          return Response.json({ error: `Re-upload window has expired (limit: ${bufferMinutes} minutes)` }, { status: 400 });
        }
        // Check max re-upload count
        const currentEditCount = parseInt(order.stage1_edit_count || 0);
        if (currentEditCount >= maxReuploadCount) {
          return Response.json({ error: `Maximum re-upload limit reached (${maxReuploadCount} edits allowed)` }, { status: 400 });
        }
        // Track reupload timestamp
        const reuploads = JSON.parse(order.stage1_reupload_times || '[]');
        reuploads.push(currentPKTDate);
        
        const reuploadFiles = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
        if (reuploadFiles.length === 0) {
          return Response.json({ error: 'Delivery Challan image/file is required' }, { status: 400 });
        }

        const finalReceivedBy = (receivedBy && receivedBy.trim()) ? receivedBy.trim() : (order.received_by || '');
        if (!finalReceivedBy) {
          return Response.json({ error: 'Received By name is required' }, { status: 400 });
        }

        // Update upload history with reupload batch
        let uploadHistory = [];
        if (order.stage1_upload_history) {
          try {
            const parsed = JSON.parse(order.stage1_upload_history);
            if (Array.isArray(parsed)) uploadHistory = parsed;
          } catch (e) {
            uploadHistory = [];
          }
        }
        // Guarantee existing batches are sequentially numbered 1..N without skips
        uploadHistory.forEach((b, idx) => {
          b.batch = idx + 1;
        });
        uploadHistory.push({
          batch: uploadHistory.length + 1,
          timestamp: currentPKTDate,
          files: reuploadFiles,
          received_by: finalReceivedBy,
          type: 'REUPLOAD'
        });

        const reachedLimit = (currentEditCount + 1) >= maxReuploadCount;
        if (reachedLimit) {
          await query(
            'UPDATE orders SET dc_image_path = ?, received_by = ?, stage1_edit_count = ?, stage1_reupload_times = ?, stage1_upload_history = ?, stage2_opened_at = ? WHERE id = ?',
            [value, finalReceivedBy, currentEditCount + 1, JSON.stringify(reuploads), JSON.stringify(uploadHistory), currentPKTDate, orderId]
          );
        } else {
          await query(
            'UPDATE orders SET dc_image_path = ?, received_by = ?, stage1_edit_count = ?, stage1_reupload_times = ?, stage1_upload_history = ? WHERE id = ?',
            [value, finalReceivedBy, currentEditCount + 1, JSON.stringify(reuploads), JSON.stringify(uploadHistory), orderId]
          );
        }
        return Response.json({ success: true, message: 'Delivery Challan re-uploaded successfully.', editLimitReached: reachedLimit });
      } else {
        return Response.json({ error: 'Order is not in the correct stage for this action' }, { status: 400 });
      }
    }

    // Stage 2: INVOICE_CREATION completes and uploads invoice
    if (action === 'COMPLETE_TASK_2') {
      if (designation !== 'INVOICE_CREATION' || order.assigned_staff_2_id !== staffId) {
        return Response.json({ error: 'Permission denied for this task stage' }, { status: 403 });
      }
      if (!value) {
        return Response.json({ error: 'Invoice file/image is required' }, { status: 400 });
      }

      if (order.status === 'PENDING_INVOICE') {
        // Verify previous stage buffer is complete (skip if prev stage edit limit reached)
        const prevEditCount = parseInt(order.stage1_edit_count || 0);
        const prevEditLimitReached = maxReuploadCount >= 0 && prevEditCount >= maxReuploadCount;
        const elapsedPrev = Date.now() - parsePKTDate(order.stage1_completed_at).getTime();
        if (elapsedPrev < bufferMs && !prevEditLimitReached) {
          return Response.json({ error: 'Previous stage buffer is still active. Please wait.' }, { status: 400 });
        }

        // Initial submission
        const bufferOffset = maxReuploadCount === 0 ? 0 : bufferMs;
        const stage3OpenDateObj = new Date(parsePKTDate(currentPKTDate).getTime() + bufferOffset);
        const stage3OpenedAt = formatKarachiDate(stage3OpenDateObj);

        await query(
          'UPDATE orders SET invoice_image_path = ?, stage2_completed_at = ?, stage3_opened_at = ?, status = ? WHERE id = ?',
          [value, currentPKTDate, stage3OpenedAt, 'PENDING_COURIER', orderId]
        );

        // Fetch client name and order type details
        const clientRows = await query('SELECT name FROM clients WHERE id = ?', [order.client_id]);
        const clientName = clientRows && clientRows.length > 0 ? clientRows[0].name : '';
        
        let orderTypeName = '';
        if (order.order_type_id) {
          const typeRows = await query('SELECT name FROM order_types WHERE id = ?', [order.order_type_id]);
          if (typeRows && typeRows.length > 0) {
            orderTypeName = typeRows[0].name;
          }
        }

        // Fire Stage 2 Completed notification asynchronously
        const { sendSystemEmail } = require('@/lib/mailer');
        sendSystemEmail('stage2_completed', {
          order_id: orderId,
          client_name: clientName,
          order_type: orderTypeName || 'Standard Order',
          qty: order.qty || '0',
          po_no: order.po_no || 'N/A',
          deadline_date: order.deadline_date || 'N/A',
          receiver_name: order.received_by || 'N/A',
          assigned_staff_1_id: order.assigned_staff_1_id,
          assigned_staff_2_id: order.assigned_staff_2_id,
          assigned_staff_3_id: order.assigned_staff_3_id
        }).catch(err => {
          console.error('Failed to trigger stage2_completed notification:', err);
        });

        return Response.json({ success: true, message: 'Invoice uploaded, task completed.' });
      } else if (order.status === 'PENDING_COURIER') {
        // Re-upload within buffer window check
        const elapsed = Date.now() - parsePKTDate(order.stage2_completed_at).getTime();
        if (elapsed >= bufferMs) {
          return Response.json({ error: `Re-upload window has expired (limit: ${bufferMinutes} minutes)` }, { status: 400 });
        }
        // Check max re-upload count
        const currentEditCount = parseInt(order.stage2_edit_count || 0);
        if (currentEditCount >= maxReuploadCount) {
          return Response.json({ error: `Maximum re-upload limit reached (${maxReuploadCount} edits allowed)` }, { status: 400 });
        }
        // Track reupload timestamp
        const reuploads2 = JSON.parse(order.stage2_reupload_times || '[]');
        reuploads2.push(currentPKTDate);
        const reachedLimit = (currentEditCount + 1) >= maxReuploadCount;
        if (reachedLimit) {
          await query(
            'UPDATE orders SET invoice_image_path = ?, stage2_edit_count = ?, stage2_reupload_times = ?, stage3_opened_at = ? WHERE id = ?',
            [value, currentEditCount + 1, JSON.stringify(reuploads2), currentPKTDate, orderId]
          );
        } else {
          await query(
            'UPDATE orders SET invoice_image_path = ?, stage2_edit_count = ?, stage2_reupload_times = ? WHERE id = ?',
            [value, currentEditCount + 1, JSON.stringify(reuploads2), orderId]
          );
        }
        return Response.json({ success: true, message: 'Invoice re-uploaded successfully.', editLimitReached: reachedLimit });
      } else {
        return Response.json({ error: 'Order is not in the correct stage for this action' }, { status: 400 });
      }
    }

    // Stage 3: INVOICE_COURIER adds Tracking ID and completes
    if (action === 'COMPLETE_TASK_3') {
      if (designation !== 'INVOICE_COURIER' || order.assigned_staff_3_id !== staffId) {
        return Response.json({ error: 'Permission denied for this task stage' }, { status: 403 });
      }
      if (!value) {
        return Response.json({ error: 'Tracking ID is required' }, { status: 400 });
      }

      if (order.status === 'PENDING_COURIER') {
        // Verify previous stage buffer is complete (skip if prev stage edit limit reached)
        const prevEditCount3 = parseInt(order.stage2_edit_count || 0);
        const prevEditLimitReached3 = maxReuploadCount >= 0 && prevEditCount3 >= maxReuploadCount;
        const elapsedPrev = Date.now() - parsePKTDate(order.stage2_completed_at).getTime();
        if (elapsedPrev < bufferMs && !prevEditLimitReached3) {
          return Response.json({ error: 'Previous stage buffer is still active. Please wait.' }, { status: 400 });
        }

        // Initial submission
        await query(
          'UPDATE orders SET tracking_id = ?, stage3_completed_at = ?, status = ? WHERE id = ?',
          [value, currentPKTDate, 'COMPLETED', orderId]
        );

        // Fetch client name and order type details
        const clientRows = await query('SELECT name FROM clients WHERE id = ?', [order.client_id]);
        const clientName = clientRows && clientRows.length > 0 ? clientRows[0].name : '';
        
        let orderTypeName = '';
        if (order.order_type_id) {
          const typeRows = await query('SELECT name FROM order_types WHERE id = ?', [order.order_type_id]);
          if (typeRows && typeRows.length > 0) {
            orderTypeName = typeRows[0].name;
          }
        }

        // Fire Order Completed notification asynchronously
        const { sendSystemEmail } = require('@/lib/mailer');
        sendSystemEmail('order_completed', {
          order_id: orderId,
          client_name: clientName,
          order_type: orderTypeName || 'Standard Order',
          qty: order.qty || '0',
          po_no: order.po_no || 'N/A',
          deadline_date: order.deadline_date || 'N/A',
          receiver_name: order.received_by || 'N/A',
          courier_id: value,
          assigned_staff_1_id: order.assigned_staff_1_id,
          assigned_staff_2_id: order.assigned_staff_2_id,
          assigned_staff_3_id: order.assigned_staff_3_id
        }).catch(err => {
          console.error('Failed to trigger order_completed notification:', err);
        });

        return Response.json({ success: true, message: 'Courier Tracking ID added. Order completed successfully!' });
      } else if (order.status === 'COMPLETED') {
        // Re-upload within buffer window check
        const elapsed = Date.now() - parsePKTDate(order.stage3_completed_at).getTime();
        if (elapsed >= bufferMs) {
          return Response.json({ error: `Re-upload window has expired (limit: ${bufferMinutes} minutes)` }, { status: 400 });
        }
        // Check max re-upload count
        const currentEditCount = parseInt(order.stage3_edit_count || 0);
        if (currentEditCount >= maxReuploadCount) {
          return Response.json({ error: `Maximum re-upload limit reached (${maxReuploadCount} edits allowed)` }, { status: 400 });
        }
        // Track reupload timestamp
        const reuploads3 = JSON.parse(order.stage3_reupload_times || '[]');
        reuploads3.push(currentPKTDate);
        await query(
          'UPDATE orders SET tracking_id = ?, stage3_edit_count = ?, stage3_reupload_times = ? WHERE id = ?',
          [value, currentEditCount + 1, JSON.stringify(reuploads3), orderId]
        );
        const reachedLimit = (currentEditCount + 1) >= maxReuploadCount;
        return Response.json({ success: true, message: 'Courier Tracking ID re-uploaded successfully.', editLimitReached: reachedLimit });
      } else {
        return Response.json({ error: 'Order is not in the correct stage for this action' }, { status: 400 });
      }
    }

    return Response.json({ error: 'Invalid workflow action' }, { status: 400 });
  } catch (error) {
    console.error('Update order state error:', error);
    return Response.json({ error: 'Internal server error during order update' }, { status: 500 });
  }
}


