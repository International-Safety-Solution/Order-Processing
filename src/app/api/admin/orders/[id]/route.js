import fs from 'fs';
import path from 'path';
import { query } from '@/lib/db';
import { getSession, getUserPermissions } from '@/lib/auth';

export async function PUT(request, context) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const permissions = await getUserPermissions(session);
  if (session.role !== 'ADMIN' && !permissions?.order_processing?.edit) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await context.params;
  const orderId = parseInt(id);

  try {
    const { clientId, orderTypeId, details, qty, deadlineDate, staff1Id, staff2Id, staff3Id, poNo, poFilePath } = await request.json();

    if (!clientId || !details || !staff1Id || !staff2Id || !staff3Id) {
      return Response.json({ error: 'All mandatory fields are required' }, { status: 400 });
    }

    await query(
      `UPDATE orders 
       SET client_id = ?, order_type_id = ?, details = ?, qty = ?, deadline_date = ?, 
           assigned_staff_1_id = ?, assigned_staff_2_id = ?, assigned_staff_3_id = ?,
           po_no = ?, po_file_path = ?
       WHERE id = ?`,
      [
        parseInt(clientId),
        orderTypeId ? parseInt(orderTypeId) : null,
        details,
        qty ? parseInt(qty) : null,
        deadlineDate || null,
        parseInt(staff1Id),
        parseInt(staff2Id),
        parseInt(staff3Id),
        poNo || null,
        poFilePath || null,
        orderId
      ]
    );

    return Response.json({ success: true, message: 'Order updated successfully' });
  } catch (error) {
    console.error('Update order error:', error);
    return Response.json({ error: 'Failed to update order details' }, { status: 500 });
  }
}

export async function DELETE(request, context) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const permissions = await getUserPermissions(session);
  if (session.role !== 'ADMIN' && !permissions?.order_processing?.delete) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await context.params;
  const orderId = parseInt(id);

  try {
    // Completely delete the order from the database
    await query('DELETE FROM orders WHERE id = ?', [orderId]);
    return Response.json({ success: true, message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Delete order error:', error);
    return Response.json({ error: 'Failed to delete order from system' }, { status: 500 });
  }
}


export async function PATCH(request, context) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const permissions = await getUserPermissions(session);
  if (session.role !== 'ADMIN' && !permissions?.order_processing?.edit) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await context.params;
  const orderId = parseInt(id);

  try {
    const body = await request.json();
    const { action } = body;

    // Fetch current order
    const orders = await query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!orders || orders.length === 0) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }
    const order = orders[0];

    // ACTION 1: REOPEN STAGE
    if (action === 'REOPEN_STAGE') {
      const stage = parseInt(body.stage);
      const clearFiles = !!body.clearFiles;

      if (stage === 1) {
        let dcPath = order.dc_image_path;
        let uploadHist = order.stage1_upload_history;

        if (clearFiles && dcPath) {
          dcPath.split(',').filter(Boolean).forEach(f => {
            try {
              const fullP = path.join(process.cwd(), 'public', f.trim());
              if (fs.existsSync(fullP)) fs.unlinkSync(fullP);
            } catch (e) {
              console.error('File unlink error:', e);
            }
          });
          dcPath = null;
          uploadHist = null;
        }

        await query(
          `UPDATE orders 
           SET status = 'PENDING_TASK',
               stage1_completed_at = NULL,
               stage1_edit_count = 0,
               stage1_reupload_times = NULL,
               stage2_opened_at = NULL,
               stage2_completed_at = NULL,
               stage2_edit_count = 0,
               stage2_reupload_times = NULL,
               stage3_opened_at = NULL,
               stage3_completed_at = NULL,
               stage3_edit_count = 0,
               stage3_reupload_times = NULL,
               dc_image_path = ?,
               stage1_upload_history = ?
           WHERE id = ?`,
          [dcPath, uploadHist, orderId]
        );

        return Response.json({
          success: true,
          message: 'Stage 1 reopened successfully. Stage 2 and Stage 3 are now locked for staff.',
          status: 'PENDING_TASK',
          dc_image_path: dcPath,
          stage1_upload_history: uploadHist
        });
      } else if (stage === 2) {
        let invPath = order.invoice_image_path;
        if (clearFiles && invPath) {
          invPath.split(',').filter(Boolean).forEach(f => {
            try {
              const fullP = path.join(process.cwd(), 'public', f.trim());
              if (fs.existsSync(fullP)) fs.unlinkSync(fullP);
            } catch (e) {
              console.error('File unlink error:', e);
            }
          });
          invPath = null;
        }

        await query(
          `UPDATE orders 
           SET status = 'PENDING_INVOICE',
               stage2_completed_at = NULL,
               stage2_edit_count = 0,
               stage2_reupload_times = NULL,
               stage3_opened_at = NULL,
               stage3_completed_at = NULL,
               stage3_edit_count = 0,
               stage3_reupload_times = NULL,
               invoice_image_path = ?
           WHERE id = ?`,
          [invPath, orderId]
        );

        return Response.json({
          success: true,
          message: 'Stage 2 reopened successfully. Stage 3 is now locked for staff.',
          status: 'PENDING_INVOICE',
          invoice_image_path: invPath
        });
      } else if (stage === 3) {
        let trkId = order.tracking_id;
        if (clearFiles) {
          trkId = null;
        }

        await query(
          `UPDATE orders 
           SET status = 'PENDING_COURIER',
               stage3_completed_at = NULL,
               stage3_edit_count = 0,
               stage3_reupload_times = NULL,
               tracking_id = ?
           WHERE id = ?`,
          [trkId, orderId]
        );

        return Response.json({
          success: true,
          message: 'Stage 3 reopened successfully. Courier staff can update tracking details.',
          status: 'PENDING_COURIER',
          tracking_id: trkId
        });
      } else {
        return Response.json({ error: 'Invalid stage number' }, { status: 400 });
      }
    }

    // ACTION 2: REMOVE UPLOADED FILE
    if (action === 'REMOVE_FILE') {
      const { fileType, filePath } = body;

      if (fileType === 'DC') {
        const existingPaths = order.dc_image_path ? order.dc_image_path.split(',').map(s => s.trim()).filter(Boolean) : [];
        const newPaths = existingPaths.filter(p => p !== filePath);
        const finalDcPath = newPaths.length > 0 ? newPaths.join(',') : null;

        // Physical deletion
        if (filePath) {
          try {
            const fullP = path.join(process.cwd(), 'public', filePath.trim());
            if (fs.existsSync(fullP)) fs.unlinkSync(fullP);
          } catch (e) {
            console.error('File unlink error:', e);
          }
        }

        // Update upload history
        let uploadHist = null;
        if (order.stage1_upload_history) {
          try {
            const parsed = JSON.parse(order.stage1_upload_history);
            if (Array.isArray(parsed)) {
              const updatedHistory = parsed.map(b => ({
                ...b,
                files: Array.isArray(b.files) ? b.files.filter(f => f !== filePath) : []
              })).filter(b => b.files.length > 0 || b.type === 'FINAL');
              uploadHist = updatedHistory.length > 0 ? JSON.stringify(updatedHistory) : null;
            }
          } catch (e) {
            uploadHist = order.stage1_upload_history;
          }
        }

        await query(
          'UPDATE orders SET dc_image_path = ?, stage1_upload_history = ? WHERE id = ?',
          [finalDcPath, uploadHist, orderId]
        );

        return Response.json({
          success: true,
          message: 'Delivery Challan file removed successfully. Staff can re-upload.',
          dc_image_path: finalDcPath,
          stage1_upload_history: uploadHist
        });
      } else if (fileType === 'INVOICE') {
        const existingPaths = order.invoice_image_path ? order.invoice_image_path.split(',').map(s => s.trim()).filter(Boolean) : [];
        const newPaths = existingPaths.filter(p => p !== filePath);
        const finalInvPath = newPaths.length > 0 ? newPaths.join(',') : null;

        if (filePath) {
          try {
            const fullP = path.join(process.cwd(), 'public', filePath.trim());
            if (fs.existsSync(fullP)) fs.unlinkSync(fullP);
          } catch (e) {
            console.error('File unlink error:', e);
          }
        }

        await query(
          'UPDATE orders SET invoice_image_path = ? WHERE id = ?',
          [finalInvPath, orderId]
        );

        return Response.json({
          success: true,
          message: 'Invoice file removed successfully. Accounts staff can re-upload.',
          invoice_image_path: finalInvPath
        });
      } else if (fileType === 'TRACKING') {
        await query(
          'UPDATE orders SET tracking_id = NULL WHERE id = ?',
          [orderId]
        );

        return Response.json({
          success: true,
          message: 'Tracking ID removed successfully.',
          tracking_id: null
        });
      } else {
        return Response.json({ error: 'Invalid fileType' }, { status: 400 });
      }
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Patch order error:', error);
    return Response.json({ error: 'Failed to update order workflow state' }, { status: 500 });
  }
}
