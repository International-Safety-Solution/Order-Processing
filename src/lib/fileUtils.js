// Utility helper to generate safe, browser-compatible URLs for uploaded files
export function getSafeFileUrl(filePath) {
  if (!filePath) return '';
  let normalized = filePath.replace(/\\/g, '/').trim();
  if (!normalized.startsWith('/') && !normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = '/' + normalized;
  }
  return normalized
    .split('/')
    .map(segment => {
      if (!segment) return '';
      try {
        return encodeURIComponent(decodeURIComponent(segment));
      } catch (e) {
        return encodeURIComponent(segment);
      }
    })
    .join('/');
}
