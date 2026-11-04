import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { getSession } from '@/lib/auth';
import { formatKarachiShortDate } from '@/lib/dateUtils';
import { getPrimaryUploadDir } from '@/lib/storageUtils';

function sanitizeName(str) {
  if (!str) return '';
  return str.replace(/[\\/:*?"<>|#]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Allowed file extensions and MIME types whitelist
const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.pdf']);
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/pdf'
]);

// Maximum file size: 15MB
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

export async function POST(request) {
  try {
    // 1. Authentication Check
    const session = await getSession();
    if (!session) {
      return Response.json({ error: 'Unauthorized. Please login to upload files.' }, { status: 401 });
    }

    if (session.must_change_password) {
      return Response.json({ error: 'Password change required before uploading documents.' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    let docType = (formData.get('docType') || formData.get('category') || 'PO').trim();
    let orderNo = (formData.get('orderNo') || formData.get('orderId') || '').toString().trim();
    let clientName = (formData.get('clientName') || '').toString().trim();
    let customDate = (formData.get('date') || '').toString().trim();

    if (!file || typeof file === 'string') {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    // 2. File Size Validation
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return Response.json({ error: 'File size exceeds 15MB limit.' }, { status: 400 });
    }

    // 3. File Extension & Type Whitelist
    let ext = path.extname(file.name || '').toLowerCase();
    if (!ext) {
      if (file.type === 'image/webp') ext = '.webp';
      else if (file.type === 'image/png') ext = '.png';
      else if (file.type === 'image/jpeg') ext = '.jpg';
      else if (file.type === 'application/pdf') ext = '.pdf';
    }

    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return Response.json({ error: `File type "${ext}" not supported. Allowed formats: PNG, JPG, WEBP, PDF.` }, { status: 400 });
    }

    if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
      return Response.json({ error: 'Invalid file format detected.' }, { status: 400 });
    }

    // 4. Normalize docType into 3 subfolders: PO, DC, Invoice
    let subFolder = 'PO';
    if (docType.toUpperCase() === 'DC' || docType.toLowerCase().includes('challan')) {
      subFolder = 'DC';
      docType = 'DC';
    } else if (docType.toUpperCase() === 'INVOICE' || docType.toLowerCase().includes('invoice')) {
      subFolder = 'Invoice';
      docType = 'Invoice';
    } else {
      subFolder = 'PO';
      docType = 'PO';
    }

    const cleanClient = sanitizeName(clientName) || 'Client';
    
    let formattedOrder = 'Order';
    if (orderNo) {
      const cleanOrderNo = sanitizeName(orderNo).replace(/^Order\s*#?/i, '');
      formattedOrder = `Order ${cleanOrderNo}`;
    }

    const dateStr = customDate ? sanitizeName(customDate) : formatKarachiShortDate();

    // Target directory: Primary persistent directory (survives redeployments)
    const baseUploadDir = getPrimaryUploadDir();
    const uploadDir = path.join(baseUploadDir, subFolder);
    await mkdir(uploadDir, { recursive: true });

    // Base filename pattern: Order No - Client Name - Date - (PO/DC/Invoice)
    const baseName = `${formattedOrder} - ${cleanClient} - ${dateStr} - ${docType}`;
    
    let filename = `${baseName}${ext}`;
    let filePath = path.join(uploadDir, filename);
    let counter = 1;

    // Append counter suffix if file with exact same name already exists
    while (existsSync(filePath)) {
      filename = `${baseName} - ${counter}${ext}`;
      filePath = path.join(uploadDir, filename);
      counter++;
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Also mirror to local public/uploads for direct Next.js static asset fallback
    const localDir = path.join(process.cwd(), 'public', 'uploads', subFolder);
    if (uploadDir !== localDir) {
      try {
        await mkdir(localDir, { recursive: true });
        await writeFile(path.join(localDir, filename), buffer);
      } catch (e) {
        // non-blocking
      }
    }

    // Also mirror to public_html/uploads so LiteSpeed/Apache can serve directly without waking Node
    const publicHtmlDir = path.join('/home/u219350258/domains/order.internationalsafetysolution.com/public_html/uploads', subFolder);
    if (uploadDir !== publicHtmlDir) {
      try {
        if (existsSync('/home/u219350258/domains/order.internationalsafetysolution.com/public_html')) {
          await mkdir(publicHtmlDir, { recursive: true });
          await writeFile(path.join(publicHtmlDir, filename), buffer);
        }
      } catch (e) {
        // non-blocking
      }
    }

    const publicPath = `/uploads/${subFolder}/${filename}`;

    return Response.json({ 
      success: true, 
      filePath: publicPath 
    });
  } catch (error) {
    console.error('File upload error:', error);
    return Response.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}
