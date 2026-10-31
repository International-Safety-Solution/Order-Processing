import { readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const MIME_TYPES = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml'
};

export async function GET(request, context) {
  try {
    const params = await context.params;
    const pathSegments = params?.path || [];
    
    if (!Array.isArray(pathSegments) || pathSegments.length === 0) {
      return new Response('File not found', { status: 404 });
    }

    const baseUploadDir = process.env.UPLOAD_DIR 
      ? path.resolve(process.env.UPLOAD_DIR) 
      : path.join(process.cwd(), 'public', 'uploads');

    // Decode URL components to handle spaces and special characters
    const decodedSegments = pathSegments.map(seg => decodeURIComponent(seg));
    const targetFilePath = path.join(baseUploadDir, ...decodedSegments);

    // Prevent directory traversal security vulnerabilities
    if (!targetFilePath.startsWith(baseUploadDir)) {
      return new Response('Access denied', { status: 403 });
    }

    if (!existsSync(targetFilePath)) {
      return new Response('File not found on server', { status: 404 });
    }

    const fileStat = await stat(targetFilePath);
    if (!fileStat.isFile()) {
      return new Response('Invalid file request', { status: 400 });
    }

    const ext = path.extname(targetFilePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const fileBuffer = await readFile(targetFilePath);

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileStat.size.toString(),
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (error) {
    console.error('Dynamic file serving error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
