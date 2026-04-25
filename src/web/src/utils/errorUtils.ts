export function extractApiError(err: unknown, fallback: string): string {
    if (!err || typeof err !== 'object') return fallback;
    const e = err as Record<string, unknown>;
    const data = (e.response as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined;
    if (typeof data?.error === 'string' && data.error) return data.error;
    if (typeof e.message === 'string' && e.message) return e.message;
    return fallback;
}
