import { describe, it, expect } from 'vitest';
import { getPlannedCardPayments, getPriorityCard } from '../models';
import type { CreditCard } from '../models';

function makeCard(id: string, name: string, balanceCents: number, transferExpirationDate?: string): CreditCard {
  return { id, name, balanceCents, transferExpirationDate };
}

describe('getPriorityCard', () => {
  it('returns null when no cards have a balance', () => {
    expect(getPriorityCard([makeCard('1', 'Visa', 0)])).toBeNull();
  });

  it('returns the only card with a balance', () => {
    const card = makeCard('1', 'Visa', 10000);
    expect(getPriorityCard([card])).toEqual(card);
  });

  it('prefers the card with an expiration date', () => {
    const noExp = makeCard('1', 'Visa', 10000);
    const withExp = makeCard('2', 'MC', 10000, '2025-12-01');
    expect(getPriorityCard([noExp, withExp])?.id).toBe('2');
  });

  it('prefers the earlier expiration date', () => {
    const later = makeCard('1', 'Visa', 10000, '2026-06-01');
    const earlier = makeCard('2', 'MC', 10000, '2025-12-01');
    expect(getPriorityCard([later, earlier])?.id).toBe('2');
  });
});

describe('getPlannedCardPayments', () => {
  it('returns empty array when no cards have a balance', () => {
    const result = getPlannedCardPayments(50000, [makeCard('1', 'Visa', 0)]);
    expect(result).toHaveLength(0);
  });

  it('returns empty array when availableCents is 0', () => {
    const result = getPlannedCardPayments(0, [makeCard('1', 'Visa', 10000)]);
    expect(result).toHaveLength(0);
  });

  it('pays partial balance when surplus is less than card balance', () => {
    const card = makeCard('1', 'Visa', 10000);
    const result = getPlannedCardPayments(5000, [card]);
    expect(result).toHaveLength(1);
    expect(result[0].card.id).toBe('1');
    expect(result[0].amountCents).toBe(5000);
  });

  it('pays full card balance when surplus exceeds it', () => {
    const card = makeCard('1', 'Visa', 3000);
    const result = getPlannedCardPayments(5000, [card]);
    expect(result).toHaveLength(1);
    expect(result[0].amountCents).toBe(3000);
  });

  it('cascades remainder to the next card when first card is paid in full', () => {
    const card1 = makeCard('1', 'Amex', 3000);  // 'Amex' sorts before 'Visa'
    const card2 = makeCard('2', 'Visa', 10000);
    const result = getPlannedCardPayments(5000, [card1, card2]);
    expect(result).toHaveLength(2);
    expect(result[0].card.id).toBe('1');
    expect(result[0].amountCents).toBe(3000);
    expect(result[1].card.id).toBe('2');
    expect(result[1].amountCents).toBe(2000);
  });

  it('can pay multiple cards in full and cascade to a third', () => {
    const card1 = makeCard('1', 'Visa', 1000, '2025-01-01');
    const card2 = makeCard('2', 'MC', 2000, '2025-06-01');
    const card3 = makeCard('3', 'Amex', 5000);
    const result = getPlannedCardPayments(5000, [card3, card1, card2]); // order should be sorted by priority
    // Priority: card1 (exp 2025-01-01), card2 (exp 2025-06-01), card3 (no exp)
    expect(result).toHaveLength(3);
    expect(result[0].card.id).toBe('1');
    expect(result[0].amountCents).toBe(1000);
    expect(result[1].card.id).toBe('2');
    expect(result[1].amountCents).toBe(2000);
    expect(result[2].card.id).toBe('3');
    expect(result[2].amountCents).toBe(2000);
  });

  it('stops allocating once surplus is exhausted', () => {
    const card1 = makeCard('1', 'Amex', 10000);  // 'Amex' sorts before 'Visa'
    const card2 = makeCard('2', 'Visa', 10000);
    const result = getPlannedCardPayments(5000, [card1, card2]);
    expect(result).toHaveLength(1);
    expect(result[0].card.id).toBe('1');
    expect(result[0].amountCents).toBe(5000);
  });
});
