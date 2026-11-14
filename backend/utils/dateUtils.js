// utils/dateUtils.js
// The daily application limit uses the Asia/Kolkata calendar day,
// no matter which timezone the server machine is in.

function getKolkataDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const values = {};
  for (const part of parts) {
    if (part.type !== 'literal') values[part.type] = part.value;
  }

  return `${values.year}-${values.month}-${values.day}`;
}

function getKolkataDayLabel(date = new Date()) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

module.exports = { getKolkataDateKey, getKolkataDayLabel };
