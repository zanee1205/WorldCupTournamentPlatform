function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

function parseDateParts(dateKey: string): [number, number, number] {
  const [year, month, day] = dateKey.split('-').map(Number);
  return [year, month, day];
}

export function toDateKey(rawDate: string, defaultYear = 2026): string {
  const cleaned = rawDate.trim();
  const parts = cleaned.split('/').map((part) => Number(part));

  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year.toString().padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
  }

  if (parts.length === 2) {
    const [day, month] = parts;
    return `${defaultYear}-${pad2(month)}-${pad2(day)}`;
  }

  throw new Error(`Unsupported date token: ${rawDate}`);
}

export function newDate(dateKey: string, timeLabel: string | null = null): Date {
  const [year, month, day] = parseDateParts(dateKey);
  const timeTokens = timeLabel && /^\d{2}:\d{2}$/.test(timeLabel) ? timeLabel.split(':').map(Number) : [12, 0];
  const [hour, minute] = timeTokens;

  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

export function formatDateKey(dateKey: string): string {
  const date = newDate(dateKey);
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(dateKey: string, timeLabel: string | null): string {
  return `${formatDateKey(dateKey)}${timeLabel ? ` • ${timeLabel}` : ''}`;
}
