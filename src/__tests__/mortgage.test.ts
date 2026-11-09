import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE } from '../engine/defaults';
import { runProjection } from '../engine/calculator';
import { fireHousingAnnual, monthlyMortgagePayment, simulateMortgage } from '../engine/mortgage';
import type { AppState } from '../engine/types';

describe('monthlyMortgagePayment', () => {
  it('matches the standard 30-year formula', () => {
    // $400,000 at 6% for 30 years ≈ $2,398.20
    expect(monthlyMortgagePayment(400_000, 0.06, 30)).toBeCloseTo(2398.2, 1);
  });

  it('divides a 0% loan evenly', () => {
    expect(monthlyMortgagePayment(120_000, 0, 10)).toBeCloseTo(1000, 5);
  });
});

describe('simulateMortgage', () => {
  const base = {
    projectionStartYear: 2026,
    yearCount: 15,
    spendingGrowthRate: 0,
    flatMonthlyPayment: 0,
    mortgage: {
      ...DEFAULT_STATE.mortgage,
      currentBalance: 120_000,
      annualInterestRate: 0,
      remainingTermYears: 10,
      extraMonthlyPayment: 0,
      principalAlreadyPaid: 0,
      monthlyEscrow: 0,
    },
    future: { ...DEFAULT_STATE.futureMortgage, enabled: false },
  };

  it('pays a 0% loan off at the end of the term', () => {
    const sim = simulateMortgage(base);
    expect(sim.currentPayoffYear).toBe(2035);
    expect(sim.years[9].endingBalance).toBe(0);
    expect(sim.years[9].loanPayment).toBeCloseTo(12_000, 2);
    expect(sim.years[10].loanPayment).toBe(0);
  });

  it('extra principal pulls the payoff year forward', () => {
    const sim = simulateMortgage({
      ...base,
      mortgage: { ...base.mortgage, extraMonthlyPayment: 1000 },
    });
    expect(sim.currentPayoffYear).toBe(2030);
    expect(sim.years[4].endingBalance).toBe(0);
    expect(sim.years[5].loanPayment).toBe(0);
  });

  it('applies principal paid down to the next mortgage', () => {
    const sim = simulateMortgage({
      ...base,
      mortgage: { ...base.mortgage, principalAlreadyPaid: 10_000 },
      future: {
        ...DEFAULT_STATE.futureMortgage,
        enabled: true,
        startYear: 2028,
        purchasePrice: 200_000,
        annualInterestRate: 0,
        termYears: 10,
        extraMonthlyPayment: 0,
      },
    });
    // 24 months of $1,000 plus $10,000 already paid.
    expect(sim.equityApplied).toBeCloseTo(34_000, 2);
    expect(sim.futureStartingBalance).toBeCloseTo(166_000, 2);
    expect(sim.rolledOver).toBe(true);
    expect(sim.currentPayoffYear).toBeNull();
    expect(sim.years.find((y) => y.calendarYear === 2028)?.loan).toBe('future');
    expect(sim.futurePayoffYear).toBe(2037);
  });

  it('drops the mortgage out of household expenses after payoff', () => {
    const state: AppState = {
      ...DEFAULT_STATE,
      expenses: { categories: [] },
      mortgage: base.mortgage,
      assumptions: { ...DEFAULT_STATE.assumptions, annualSpendingGrowth: 0, projectionLength: 15 },
    };
    const rows = runProjection(state);
    expect(rows[0].householdAnnualExpenses).toBeCloseTo(12_000, 2);
    expect(rows.find((r) => r.calendarYear === 2036)?.householdAnnualExpenses).toBe(0);
    expect(rows.find((r) => r.calendarYear === 2035)?.mortgageBalance).toBe(0);
  });

  it('leaves a flat mortgage in place until a balance is entered', () => {
    const rows = runProjection({
      ...DEFAULT_STATE,
      assumptions: { ...DEFAULT_STATE.assumptions, projectionLength: 1 },
    });
    const expected = 2537.44 * 12 * 1.035;
    expect(rows[1].householdAnnualExpenses).toBeCloseTo(expected, 0);
  });

  it('keeps a paid-off mortgage out of the FIRE housing cost', () => {
    const sim = simulateMortgage(base);
    expect(fireHousingAnnual(sim, 2036, 0, 0)).toBe(0);
    expect(fireHousingAnnual(sim, 2026, 0, 0)).toBeCloseTo(12_000, 2);
  });
});
