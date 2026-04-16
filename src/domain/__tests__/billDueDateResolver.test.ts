import { describe, it, expect } from 'vitest';
import { resolveDueDate } from '../billDueDateResolver';

describe('resolveDueDate', () => {
  it('feb 31 non-leap year overflows to mar 3', () => {
    expect(resolveDueDate(2023, 2, 31)).toBe('2023-03-03');
  });

  it('feb 31 leap year overflows to mar 2', () => {
    expect(resolveDueDate(2024, 2, 31)).toBe('2024-03-02');
  });

  it('apr 31 overflows to may 1', () => {
    expect(resolveDueDate(2024, 4, 31)).toBe('2024-05-01');
  });

  it('dec 31 no overflow', () => {
    expect(resolveDueDate(2024, 12, 31)).toBe('2024-12-31');
  });

  it('jan 28 no overflow', () => {
    expect(resolveDueDate(2024, 1, 28)).toBe('2024-01-28');
  });

  it('feb 28 non-leap no overflow', () => {
    expect(resolveDueDate(2023, 2, 28)).toBe('2023-02-28');
  });
});
