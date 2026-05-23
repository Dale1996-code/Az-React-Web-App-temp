export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function todayISO(): string {
    // Local calendar date — toISOString() returns the UTC date, which can be a
    // day ahead/behind for stores in timezones that differ from UTC.
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
