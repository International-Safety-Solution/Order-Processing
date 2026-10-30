/**
 * Centralized Date Utilities for Asia/Karachi (PKT) Timezone
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

export function getKarachiDateObj(dateInput = new Date()) {
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
  
  const parts = formatter.formatToParts(dateInput);
  const partMap = {};
  parts.forEach(p => { partMap[p.type] = p.value; });
  const str = `${partMap.year}-${partMap.month}-${partMap.day}T${partMap.hour}:${partMap.minute}:${partMap.second}`;
  return new Date(str);
}

export function parsePKTDate(dateInput) {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) {
    return getKarachiDateObj(dateInput);
  }
  const formatted = dateInput.includes('T') ? dateInput : dateInput.replace(' ', 'T');
  return new Date(formatted);
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
  
  const parts = formatter.formatToParts(dateObj);
  const partMap = {};
  parts.forEach(p => { partMap[p.type] = p.value; });
  return `${partMap.year}-${partMap.month}-${partMap.day} ${partMap.hour}:${partMap.minute}:${partMap.second}`;
}

export function formatKarachiShortDate() {
  const options = { timeZone: 'Asia/Karachi', day: '2-digit', month: 'short', year: 'numeric' };
  const formatter = new Intl.DateTimeFormat('en-GB', options);
  return formatter.format(new Date()).replace(/ /g, '-');
}

