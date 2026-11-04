import path from 'path';
import fs from 'fs';
import { mkdir, copyFile, stat } from 'fs/promises';

/**
 * Returns the primary persistent uploads directory.
 * On Hostinger Linux, persists files outside ephemeral hbuilds directories.
 */
export function getPrimaryUploadDir() {
  if (process.env.UPLOAD_DIR) {
    return path.resolve(process.env.UPLOAD_DIR);
  }

  // Hostinger persistent locations that survive Git redeployments
  const candidatePersistent = [
    '/home/u219350258/domains/order.internationalsafetysolution.com/public_html/uploads',
    '/home/u219350258/domains/order.internationalsafetysolution.com/uploads',
    '/home/u219350258/public_html/uploads',
    '/home/u219350258/uploads'
  ];

  for (const loc of candidatePersistent) {
    try {
      const parent = path.dirname(loc);
      if (fs.existsSync(parent)) {
        if (!fs.existsSync(loc)) {
          fs.mkdirSync(loc, { recursive: true });
        }
        return loc;
      }
    } catch (e) {
      // ignore and try next
    }
  }

  return path.join(process.cwd(), 'public', 'uploads');
}

/**
 * Returns all potential directories where uploaded files might reside across
 * current and previous Hostinger builds, as well as persistent folders.
 */
export function getAllCandidateUploadDirs() {
  const dirs = [];

  if (process.env.UPLOAD_DIR) {
    dirs.push(path.resolve(process.env.UPLOAD_DIR));
  }

  const primary = getPrimaryUploadDir();
  dirs.push(primary);

  // Common Hostinger persistent directory structures
  dirs.push('/home/u219350258/domains/order.internationalsafetysolution.com/public_html/uploads');
  dirs.push('/home/u219350258/domains/order.internationalsafetysolution.com/uploads');
  dirs.push('/home/u219350258/public_html/uploads');
  dirs.push('/home/u219350258/uploads');

  const cwd = process.cwd();
  dirs.push(path.join(cwd, 'public', 'uploads'));
  dirs.push(path.join(cwd, '..', 'public', 'uploads'));
  dirs.push(path.join(cwd, '..', '..', 'public', 'uploads'));
  dirs.push(path.join(cwd, '..', '..', 'uploads'));

  // 1. Scan versions folder:
  // When cwd is /home/u219350258/domains/order.internationalsafetysolution.com/hbuilds/versions/<uuid>/nodejs
  // path.resolve(cwd, '..', '..') IS the versions folder!
  const versionBases = [
    path.resolve(cwd, '..', '..'),
    path.resolve(cwd, '..'),
    '/home/u219350258/domains/order.internationalsafetysolution.com/hbuilds/versions',
    '/home/u219350258/hbuilds/versions'
  ];

  for (const vBase of versionBases) {
    try {
      if (fs.existsSync(vBase) && fs.statSync(vBase).isDirectory()) {
        const entries = fs.readdirSync(vBase);
        for (const entry of entries) {
          const entryPath = path.join(vBase, entry);
          try {
            if (fs.statSync(entryPath).isDirectory()) {
              dirs.push(path.join(entryPath, 'nodejs', 'public', 'uploads'));
              dirs.push(path.join(entryPath, 'public', 'uploads'));
              dirs.push(path.join(entryPath, 'uploads'));
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
  }

  // 2. Scan current folder:
  const currentBases = [
    path.resolve(cwd, '..', '..', '..', 'current'),
    path.resolve(cwd, '..', 'current'),
    '/home/u219350258/domains/order.internationalsafetysolution.com/hbuilds/current',
    '/home/u219350258/hbuilds/current'
  ];

  for (const cBase of currentBases) {
    try {
      if (fs.existsSync(cBase)) {
        dirs.push(path.join(cBase, 'nodejs', 'public', 'uploads'));
        dirs.push(path.join(cBase, 'public', 'uploads'));
        dirs.push(path.join(cBase, 'uploads'));
      }
    } catch (e) {}
  }

  // Deduplicate and filter non-empty
  const unique = [];
  const seen = new Set();
  for (const d of dirs) {
    if (d && !seen.has(d)) {
      seen.add(d);
      unique.push(d);
    }
  }

  return unique;
}

/**
 * Recursively scans legacy build directories and copies any existing uploaded files
 * into the primary persistent upload directory so they survive all future deployments.
 */
let _hasSynced = false;
export function syncLegacyUploads(force = false) {
  if (_hasSynced && !force) return;
  _hasSynced = true;

  try {
    const primaryDir = getPrimaryUploadDir();
    if (!fs.existsSync(primaryDir)) {
      fs.mkdirSync(primaryDir, { recursive: true });
    }

    const localUploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(localUploadsDir)) {
      try { fs.mkdirSync(localUploadsDir, { recursive: true }); } catch (e) {}
    }

    const candidateDirs = getAllCandidateUploadDirs();

    for (const dir of candidateDirs) {
      if (dir === primaryDir || !fs.existsSync(dir)) continue;

      try {
        const walkDir = (currentPath, relPrefix = '') => {
          const items = fs.readdirSync(currentPath, { withFileTypes: true });
          for (const item of items) {
            const fullItemPath = path.join(currentPath, item.name);
            const itemRelPath = relPrefix ? `${relPrefix}/${item.name}` : item.name;

            if (item.isDirectory()) {
              walkDir(fullItemPath, itemRelPath);
            } else if (item.isFile()) {
              // Copy to primary persistent storage
              const targetPath = path.join(primaryDir, itemRelPath);
              if (!fs.existsSync(targetPath)) {
                fs.mkdirSync(path.dirname(targetPath), { recursive: true });
                fs.copyFileSync(fullItemPath, targetPath);
                console.log(`[STORAGE SYNC] Migrated ${itemRelPath} -> ${targetPath}`);
              }

              // Also copy to current build's public/uploads for direct static serving
              const localTarget = path.join(localUploadsDir, itemRelPath);
              if (!fs.existsSync(localTarget)) {
                try {
                  fs.mkdirSync(path.dirname(localTarget), { recursive: true });
                  fs.copyFileSync(fullItemPath, localTarget);
                } catch (e) {}
              }

              // If file is in uploads root but has - DC or - PO or - Invoice, also copy into respective subfolder
              const lowerName = item.name.toLowerCase();
              if (!relPrefix) {
                let targetSub = null;
                if (lowerName.includes('- dc') || lowerName.includes('delivery challan')) targetSub = 'DC';
                else if (lowerName.includes('- po') || lowerName.includes('purchase order')) targetSub = 'PO';
                else if (lowerName.includes('- invoice')) targetSub = 'Invoice';

                if (targetSub) {
                  const subTargetPath = path.join(primaryDir, targetSub, item.name);
                  if (!fs.existsSync(subTargetPath)) {
                    fs.mkdirSync(path.dirname(subTargetPath), { recursive: true });
                    fs.copyFileSync(fullItemPath, subTargetPath);
                  }
                  const localSubTarget = path.join(localUploadsDir, targetSub, item.name);
                  if (!fs.existsSync(localSubTarget)) {
                    try {
                      fs.mkdirSync(path.dirname(localSubTarget), { recursive: true });
                      fs.copyFileSync(fullItemPath, localSubTarget);
                    } catch (e) {}
                  }
                }
              }
            }
          }
        };

        walkDir(dir);
      } catch (e) {
        // Continue with next dir
      }
    }
  } catch (err) {
    console.error('[STORAGE SYNC] Error migrating legacy files:', err);
  }
}

/**
 * Bulletproof server-side file finder that searches across all candidate directories,
 * subfolders, and version archives.
 */
export function findFileOnServer(decodedSegments) {
  if (!Array.isArray(decodedSegments) || decodedSegments.length === 0) return null;

  const targetFilename = decodedSegments[decodedSegments.length - 1];
  const targetSubfolder = decodedSegments.length > 1 ? decodedSegments[0] : null;
  const candidateDirs = getAllCandidateUploadDirs();

  // 1. Direct match on relative path
  for (const dir of candidateDirs) {
    try {
      const candidate = path.join(dir, ...decodedSegments);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    } catch (e) {}
  }

  // 2. Subfolder variations (DC, PO, Invoice, or root)
  const subfoldersToCheck = [];
  if (targetSubfolder) subfoldersToCheck.push(targetSubfolder);
  subfoldersToCheck.push('DC', 'PO', 'Invoice', '');

  for (const dir of candidateDirs) {
    for (const sub of subfoldersToCheck) {
      try {
        const candidate = sub ? path.join(dir, sub, targetFilename) : path.join(dir, targetFilename);
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return candidate;
        }
      } catch (e) {}
    }
  }

  // 3. Normalized / case-insensitive filename search in candidate directories
  const cleanTarget = targetFilename.trim().toLowerCase();
  const parsedTarget = path.parse(targetFilename);
  const targetBaseWithoutExt = parsedTarget.name.toLowerCase();

  for (const dir of candidateDirs) {
    for (const sub of ['DC', 'PO', 'Invoice', '']) {
      try {
        const checkDir = sub ? path.join(dir, sub) : dir;
        if (fs.existsSync(checkDir) && fs.statSync(checkDir).isDirectory()) {
          const files = fs.readdirSync(checkDir);
          for (const f of files) {
            const fLower = f.toLowerCase();
            // Match exact filename case-insensitively, or base name without ext
            if (fLower === cleanTarget || path.parse(f).name.toLowerCase() === targetBaseWithoutExt) {
              const fullCandidate = path.join(checkDir, f);
              if (fs.statSync(fullCandidate).isFile()) {
                return fullCandidate;
              }
            }
          }
        }
      } catch (e) {}
    }
  }

  return null;
}
