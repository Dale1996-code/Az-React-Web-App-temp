export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function todayISO(): string {
    return new Date().toISOString().split('T')[0];
}
