import { describe, expect, it } from 'vitest';
import { isMinor, parseBirthDate } from './guardians.js';

describe('guardian age eligibility', () => {
  it('ends access at midnight on the eighteenth birthday in Istanbul', () => {
    const birthday = new Date('2008-10-14T00:00:00Z');
    expect(isMinor(birthday, new Date('2026-10-13T20:59:59Z'))).toBe(true);
    expect(isMinor(birthday, new Date('2026-10-13T21:00:00Z'))).toBe(false);
  });

  it('uses calendar years rather than a fixed number of days', () => {
    const birthday = new Date('2008-02-29T00:00:00Z');
    expect(isMinor(birthday, new Date('2026-02-28T12:00:00Z'))).toBe(true);
    expect(isMinor(birthday, new Date('2026-03-01T12:00:00Z'))).toBe(false);
  });

  it('does not infer a minor age from missing, invalid or future dates', () => {
    const now = new Date('2026-10-14T12:00:00Z');
    for (const birthDate of [null, undefined, new Date('invalid'), new Date('2026-10-15T00:00:00Z')]) {
      expect(isMinor(birthDate, now)).toBe(false);
    }
  });

  it('accepts real leap dates and permits clearing an unknown birth date', () => {
    expect(parseBirthDate('2008-02-29')?.toISOString()).toBe('2008-02-29T00:00:00.000Z');
    expect(parseBirthDate(null)).toBeNull();
    expect(parseBirthDate('')).toBeNull();
  });

  it.each(['2009-02-29', '2010-04-31', '2010-13-01', '2010-00-01', '2010-1-01', '01/01/2010', '1899-12-31', '9999-01-01', 123, {}])(
    'rejects invalid date input %j', (value) => {
      expect(() => parseBirthDate(value)).toThrow();
    },
  );
});
