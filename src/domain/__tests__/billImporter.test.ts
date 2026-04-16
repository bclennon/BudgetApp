import { describe, it, expect } from 'vitest';
import { parseImportText } from '../billImporter';

describe('parseImportText', () => {
  it('parses basic tab-delimited lines', () => {
    const text = 'Rent\t1\t1200\nNetflix\t15\t20';
    const rows = parseImportText(text);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ name: 'Rent', dayOfMonth: 1, amountCents: 120000 });
    expect(rows[1]).toEqual({ name: 'Netflix', dayOfMonth: 15, amountCents: 2000 });
  });

  it('strips $ and , from amount', () => {
    const rows = parseImportText('Home Loan\t30\t$2,197');
    expect(rows[0].amountCents).toBe(219700);
  });

  it('skips blank and whitespace-only lines', () => {
    const text = 'Blink\t5\t10\n\t\t\nEnergy\t7\t50\n   ';
    const rows = parseImportText(text);
    expect(rows).toHaveLength(2);
  });

  it('returns error for invalid day', () => {
    const rows = parseImportText('Bad\t99\t10');
    expect(rows[0].error).toMatch(/day/);
  });

  it('returns error for non-positive amount', () => {
    const rows = parseImportText('Bad\t5\t0');
    expect(rows[0].error).toMatch(/amount/);
  });

  it('returns error for missing name', () => {
    const rows = parseImportText('\t5\t10');
    expect(rows[0].error).toMatch(/name/);
  });

  it('handles names with parentheses and special chars', () => {
    const rows = parseImportText('rock loan (503.57)\t21\t504');
    expect(rows[0].name).toBe('rock loan (503.57)');
    expect(rows[0].amountCents).toBe(50400);
  });

  it('parses the full sample text from the problem statement', () => {
    const text = [
      'Blink\t5\t10',
      'Energy \t7\t50',
      'progressive\t11\t129',
      'peacock \t11\t19',
      'Netflix\t13\t20',
      'Citi\t14\t10',
      'amex\t14\t10',
      'Car Loan\t15\t320',
      'IHG Rewards\t15\t10',
      'Chase United\t13\t10',
      'Verizon Wrls\t16\t100',
      'Plex\t16\t$5',
      'Spectrum\t20\t60',
      'rock loan (503.57)\t21\t504',
      'hbo max\t22\t$20',
      '\t\t',
      'Microsoft/xbox\t23\t$16',
      '\t\t',
      'Uber One\t25\t$10',
      'Vacation/Savings\t25\t$1,300',
      '\t\t',
      'YouTube Premium\t27\t15',
      'Affirm\t28\t$50',
      'Home Loan\t30\t$2,197',
    ].join('\n');

    const rows = parseImportText(text);
    const valid = rows.filter((r) => !r.error);
    expect(valid).toHaveLength(21);
    const homeLoan = valid.find((r) => r.name === 'Home Loan');
    expect(homeLoan?.amountCents).toBe(219700);
    const vacation = valid.find((r) => r.name === 'Vacation/Savings');
    expect(vacation?.amountCents).toBe(130000);
  });
});
