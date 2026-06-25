export function safeString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

export function toInt(value: unknown): number | null {
    if (typeof value === 'number' && Number.isInteger(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return Math.trunc(parsed);
    }
    return null;
}

export function toDateKey(date?: string): string {
    if (!date) return '';
    return date.trim();
}

export function toVietnamTimeLabel(time?: string): string {
    if (!time) return '';
    const trimmed = time.trim();
    const match = trimmed.match(/^(?<hh>\d{1,2}):(?<mm>\d{2})\s*UTC(?<offset>[+-]\d{1,2})$/i);
    if (!match?.groups) return trimmed;

    const hour = Number(match.groups.hh);
    const minute = Number(match.groups.mm);
    const offsetHours = Number(match.groups.offset);

    if (!Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(offsetHours)) {
        return trimmed;
    }

    const shiftMinutes = (7 - offsetHours) * 60;
    const totalMinutes = hour * 60 + minute + shiftMinutes;
    const normalized = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
    const outHours = Math.floor(normalized / 60);
    const outMinutes = normalized % 60;

    return `${String(outHours).padStart(2, '0')}:${String(outMinutes).padStart(2, '0')}`;
}

export function makeId(value: string): string {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return `${Math.abs(hash)}`;
}
