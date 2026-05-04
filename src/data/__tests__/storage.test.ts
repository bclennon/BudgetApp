import { describe, it, expect } from 'vitest';
import { getNextBillId } from '../storage';
import type { Bill } from '../../domain/models';

describe('getNextBillId', () => {
  it('returns 1 when there are no bills', () => {
    expect(getNextBillId([])).toBe(1);
  });

  it('returns max id + 1 when bills exist', () => {
    const bills: Bill[] = [
      { id: 1, name: 'Rent', amountCents: 100000, dayOfMonth: 1 },
      { id: 3, name: 'Internet', amountCents: 5000, dayOfMonth: 15 },
    ];
    expect(getNextBillId(bills)).toBe(4);
  });
});
