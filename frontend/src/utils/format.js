// The backend stores every time as ISO text (2026-10-21T18:24:05).
// These helpers turn it into something friendly for the screen.

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

// "21 Oct, 6:24 pm"
export const formatDateTime = (value) => {
  const date = toDate(value);
  if (!date) return value || '—';
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' });
};

// "just now", "5 min ago", "3 h ago", "2 days ago"
export const timeAgo = (value) => {
  const date = toDate(value);
  if (!date) return value || '—';
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  const days = Math.floor(seconds / 86400);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

// ₹1,234.50  (no decimals when it is a whole number)
export const rupees = (value) => {
  const number = Number(value || 0);
  return `₹${number.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

// "+12.5%" / "-3%" / "—" (no data to compare with)
export const percentText = (value) => {
  if (value === null || value === undefined) return '—';
  return `${value > 0 ? '+' : ''}${value}%`;
};
