import { describe, it, expect, vi, afterEach } from 'vitest';
import { todayISO, ISO_DATE_RE } from '../../utils/dateUtils';

describe('todayISO', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns YYYY-MM-DD format', () => {
        const result = todayISO();
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('returns the correct date for a fixed timestamp', () => {
        vi.setSystemTime(new Date('2026-04-19T12:00:00Z'));
        expect(todayISO()).toBe('2026-04-19');
    });

    it('does not include time component', () => {
        const result = todayISO();
        expect(result).not.toContain('T');
        expect(result.length).toBe(10);
    });
});

describe('ISO_DATE_RE', () => {
    it('accepts valid ISO dates', () => {
        expect(ISO_DATE_RE.test('2026-04-19')).toBe(true);
        expect(ISO_DATE_RE.test('2000-01-01')).toBe(true);
        expect(ISO_DATE_RE.test('1999-12-31')).toBe(true);
    });

    it('rejects invalid formats', () => {
        expect(ISO_DATE_RE.test('19-04-2026')).toBe(false);
        expect(ISO_DATE_RE.test('2026/04/19')).toBe(false);
        expect(ISO_DATE_RE.test('2026-4-19')).toBe(false);
        expect(ISO_DATE_RE.test('2026-04-1')).toBe(false);
        expect(ISO_DATE_RE.test('')).toBe(false);
        expect(ISO_DATE_RE.test('2026-04-19T12:00:00')).toBe(false);
    });
});
