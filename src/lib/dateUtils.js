/**
 * Centralized Date Utilities for Asia/Karachi (PKT) Timezone (UTC+5)
 */

export function getKarachiDate() {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(new Date());
  const partMap = {};
  parts.forEach(p => { partMap[p.type] = p.value; });
  return `${partMap.year}-${partMap.month}-${partMap.day} ${partMap.hour}:${partMap.minute}:${partMap.second}`;
}

export function parsePKTDate(dateInput) {
  if (!dateInput) return new Date();
  
  if (dateInput instanceof Date) {
    return dateInput;
  }
  
  if (typeof dateInput === 'string') {
    let str = dateInput.trim();
    if (!str) return new Date();
    
    // If it already has an offset like +05:00 or -05:00
    if (/[+-]\d{2}:\d{2}$/.test(str)) {
      return new Date(str);
    }
    
    // Strip trailing 'Z' and milliseconds if present,
    // because dates in MySQL were stored as PKT time (e.g. "2026-11-02 00:42:00").
    // If MySQL2 or JSON serialization added 'Z', it falsely treated PKT as UTC (+300m offset).
    str = str.replace('Z', '').split('.')[0].replace(' ', 'T');
    
    return new Date(`${str}+05:00`);
  }
  
  return new Date(dateInput);
}

export function getKarachiDateObj(dateInput = new Date()) {
  return parsePKTDate(dateInput);
}

export function formatKarachiDate(dateObj) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(dateObj instanceof Date ? dateObj : parsePKTDate(dateObj));
  const partMap = {};
  parts.forEach(p => { partMap[p.type] = p.value; });
  return `${partMap.year}-${partMap.month}-${partMap.day} ${partMap.hour}:${partMap.minute}:${partMap.second}`;
}

export function formatKarachiShortDate() {
  const options = { timeZone: 'Asia/Karachi', day: '2-digit', month: 'short', year: 'numeric' };
  const formatter = new Intl.DateTimeFormat('en-GB', options);
  return formatter.format(new Date()).replace(/ /g, '-');
}

