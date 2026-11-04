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

  // Common Hostinger directory structures
  dirs.push('/home/u219350258/domains/order.internationalsafetysolution.com/public_html/uploads');
  dirs.push('/home/u219350258/domains/order.internationalsafetysolution.com/uploads');
  dirs.push('/home/u219350258/uploads');

  const cwd = process.cwd();
  dirs.push(path.join(cwd, 'public', 'uploads'));
  dirs.push(path.join(cwd, '..', 'public', 'uploads'));
  dirs.push(path.join(cwd, '..', '..', 'public', 'uploads'));
  dirs.push(path.join(cwd, '..', '..', 'uploads'));

  // Scan previous Hostinger build versions in hbuilds/versions/<uuid>
  try {
    const searchBases = [
      path.resolve(cwd, '..', '..', 'versions'),
      path.resolve(cwd, '..', 'versions'),
      '/home/u219350258/hbuilds/versions'
    ];

    for (const vBase of searchBases) {
      if (fs.existsSync(vBase)) {
        const versions = fs.readdirSync(vBase);
        for (const v of versions) {
          dirs.push(path.join(vBase, v, 'nodejs', 'public', 'uploads'));
          dirs.push(path.join(vBase, v, 'public', 'uploads'));
        }
      }
    }
  } catch (e) {
    // ignore
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
