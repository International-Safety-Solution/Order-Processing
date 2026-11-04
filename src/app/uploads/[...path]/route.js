import { readFile, stat, copyFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { 
  getAllCandidateUploadDirs, 
  getPrimaryUploadDir, 
  findFileOnServer, 
  syncLegacyUploads 
} from '@/lib/storageUtils';

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

    // Decode URL components safely
    const decodedSegments = pathSegments.map(seg => {
      try {
        return decodeURIComponent(seg);
      } catch (e) {
        return seg;
      }
    });

    // Guard against directory traversal
    if (decodedSegments.some(seg => seg.includes('..') || seg.includes('/') || seg.includes('\\'))) {
      return new Response('Access denied', { status: 403 });
    }

    let foundFilePath = findFileOnServer(decodedSegments);

    // If not immediately found, trigger legacy sync and try again
    if (!foundFilePath) {
      syncLegacyUploads(true);
      foundFilePath = findFileOnServer(decodedSegments);
    }

    if (!foundFilePath) {
      console.warn(`[STORAGE 404] File not found: ${decodedSegments.join('/')}`);
      return new Response('File not found on server', { status: 404 });
    }

    // Auto-sync found file into the primary persistent upload directory so it is never lost again
    const primaryDir = getPrimaryUploadDir();
    const primaryTarget = path.join(primaryDir, ...decodedSegments);
    if (foundFilePath !== primaryTarget && !existsSync(primaryTarget)) {
      try {
        await mkdir(path.dirname(primaryTarget), { recursive: true });
        await copyFile(foundFilePath, primaryTarget);
      } catch (e) {
        // non-blocking
      }
    }

    // Also copy to current build's public/uploads for direct static serving
    const localTarget = path.join(process.cwd(), 'public', 'uploads', ...decodedSegments);
    if (foundFilePath !== localTarget && !existsSync(localTarget)) {
      try {
        await mkdir(path.dirname(localTarget), { recursive: true });
        await copyFile(foundFilePath, localTarget);
      } catch (e) {
        // non-blocking
      }
    }

    const fileStat = await stat(foundFilePath);
    const ext = path.extname(foundFilePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const fileBuffer = await readFile(foundFilePath);

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

export async function HEAD(request, context) {
  return GET(request, context);
}
