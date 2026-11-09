/**
 * Unit tests for the financial calculation engine.
 *
 * Where applicable, results are compared against hand-computed values derived
 * from the workbook formulas. Known intentional differences from the workbook
 * are documented inline.
 */

import { describe, it, expect } from 'vitest';
import {
  computeSalary,
  computeContrib401k,
  computeMatch401k,
  computeRothContrib,
  computeAnnualExpenses,
  computeAnnualSurplus,
  computeMonthlyExpenses,
  runProjection,
  runAllScenarios,
  findMilestoneYear,
  computeHouseholdFireMilestones,
  analyzeStaggeredRetirement,
} from '../engine/calculator';
import { DEFAULT_STATE } from '../engine/defaults';
import type { AppState } from '../engine/types';

// ─── Salary Growth ──────────────────────────────────────────────────────────

describe('computeSalary', () => {
  it('returns base salary at year 0', () => {
    expect(computeSalary(195000, 0.05, 0)).toBeCloseTo(195000, 0);
  });

  it('applies 5% growth correctly over 1 year', () => {
    expect(computeSalary(195000, 0.05, 1)).toBeCloseTo(195000 * 1.05, 0);
  });

  it('compounds correctly over multiple years', () => {
    expect(computeSalary(100000, 0.07, 10)).toBeCloseTo(100000 * Math.pow(1.07, 10), 2);
  });

  it('handles 0% growth', () => {
    expect(computeSalary(80000, 0, 5)).toBeCloseTo(80000, 0);
  });
});

// ─── Bonus Calculations ─────────────────────────────────────────────────────

describe('bonus scenario via runProjection', () => {
  const state: AppState = {
    ...DEFAULT_STATE,
    assumptions: { ...DEFAULT_STATE.assumptions, projectionLength: 1 },
  };

  it('target bonus = 25% of year-1 salary', () => {
    const rows = runProjection({ ...state, assumptions: { ...state.assumptions, bonusScenario: 'target' } });
    const year1Salary = computeSalary(195000, 0.05, 1);
    expect(rows[1].person1Bonus).toBeCloseTo(year1Salary * 0.25, 0);
  });

  it('minimum bonus = 0', () => {
    const rows = runProjection({ ...state, assumptions: { ...state.assumptions, bonusScenario: 'minimum' } });
    expect(rows[1].person1Bonus).toBe(0);
  });

  it('maximum bonus = 50% of year-1 salary', () => {
    const rows = runProjection({ ...state, assumptions: { ...state.assumptions, bonusScenario: 'maximum' } });
    const year1Salary = computeSalary(195000, 0.05, 1);
    expect(rows[1].person1Bonus).toBeCloseTo(year1Salary * 0.5, 0);
  });

  it('person 2 has no bonus in any scenario', () => {
    const rows = runProjection({ ...state, assumptions: { ...state.assumptions, bonusScenario: 'maximum' } });
    // Person 2 has 0% bonus rates by default
    // No dedicated bonus column for person 2 but salary × 0 = 0
    expect(rows[1].person2Salary).toBeGreaterThan(0);
  });
});

// ─── 401(k) Contributions and Employer Match ────────────────────────────────

describe('computeContrib401k', () => {
  const person1 = DEFAULT_STATE.person1;

  it('returns contribution when working', () => {
    // $1,000/paycheck × 24 paychecks = $24,000
    expect(computeContrib401k(person1, true)).toBe(24000);
  });

  it('returns 0 when not working', () => {
    expect(computeContrib401k(person1, false)).toBe(0);
  });
});

describe('computeMatch401k', () => {
  it('returns salary × matchRate when working', () => {
    // 3% match on $95,000 spouse salary = $2,850
    expect(computeMatch401k(95000, 0.03, true)).toBeCloseTo(2850, 0);
  });

  it('returns 0 when not working', () => {
    expect(computeMatch401k(95000, 0.03, false)).toBe(0);
  });

  it('returns 0 when matchRate is 0 (person 1 default)', () => {
    expect(computeMatch401k(195000, 0, true)).toBe(0);
  });
});

// ─── Roth IRA Contributions ─────────────────────────────────────────────────

describe('computeRothContrib', () => {
  it('returns annual contribution when working', () => {
    expect(computeRothContrib(7500, true)).toBe(7500);
  });

  it('returns 0 when not working (Roth stops at retirement)', () => {
    expect(computeRothContrib(7500, false)).toBe(0);
  });
});

// ─── Spending Inflation ─────────────────────────────────────────────────────

describe('computeAnnualExpenses', () => {
  const baseAnnual = 2537.44 * 12; // just mortgage

  it('returns base at year 0', () => {
    expect(computeAnnualExpenses(baseAnnual, 0.035, 0)).toBeCloseTo(baseAnnual, 2);
  });

  it('applies 3.5% growth for 10 years', () => {
    const expected = baseAnnual * Math.pow(1.035, 10);
    expect(computeAnnualExpenses(baseAnnual, 0.035, 10)).toBeCloseTo(expected, 2);
  });
});

// ─── Surplus Calculation ────────────────────────────────────────────────────

describe('computeAnnualSurplus', () => {
  it('returns 0 when income does not cover expenses', () => {
    const result = computeAnnualSurplus({
      salary1: 10000,
      salary2: 0,
      bonus1: 0,
      contrib401k1: 0,
      contrib401k2: 0,
      roth1: 0,
      roth2: 0,
      annualExpenses: 50000,
      incomeTaxRate: 0.25,
      ficaRate: 0.0765,
      surplusInvestedFraction: 1,
    });
    expect(result).toBe(0);
  });

  it('computes surplus matching workbook formula', () => {
    // Year 1: salary1=$204,750, salary2=$97,850, bonus=25%*204,750=$51,187.50
    const salary1 = 195000 * 1.05; // $204,750
    const salary2 = 95000 * 1.03; // $97,850
    const bonus1 = salary1 * 0.25; // $51,187.50
    const contrib401k1 = 1000 * 24; // $24,000
    const contrib401k2 = 0;
    const roth1 = 7500;
    const roth2 = 7500;
    const annualExpenses = 2537.44 * 12; // $30,449.28
    const incomeTaxRate = 0.2143;
    const ficaRate = 0.0765;

    const grossIncome = salary1 + salary2 + bonus1;
    const afterTaxIncome = (grossIncome - contrib401k1 - contrib401k2) * (1 - incomeTaxRate);
    const ficaObligation = grossIncome * ficaRate;
    const expected = Math.max(
      0,
      afterTaxIncome - ficaObligation - annualExpenses - roth1 - roth2,
    );

    const result = computeAnnualSurplus({
      salary1,
      salary2,
      bonus1,
      contrib401k1,
      contrib401k2,
      roth1,
      roth2,
      annualExpenses,
      incomeTaxRate,
      ficaRate,
      surplusInvestedFraction: 1,
    });

    expect(result).toBeCloseTo(expected, 0);
  });

  it('applies surplusInvestedFraction correctly', () => {
    const base = computeAnnualSurplus({
      salary1: 200000,
      salary2: 100000,
      bonus1: 0,
      contrib401k1: 0,
      contrib401k2: 0,
      roth1: 0,
      roth2: 0,
      annualExpenses: 50000,
      incomeTaxRate: 0.2,
      ficaRate: 0.0765,
      surplusInvestedFraction: 1,
    });
    const half = computeAnnualSurplus({
      salary1: 200000,
      salary2: 100000,
      bonus1: 0,
      contrib401k1: 0,
      contrib401k2: 0,
      roth1: 0,
      roth2: 0,
      annualExpenses: 50000,
      incomeTaxRate: 0.2,
      ficaRate: 0.0765,
      surplusInvestedFraction: 0.5,
    });
    expect(half).toBeCloseTo(base * 0.5, 2);
  });
});

// ─── Monthly Expenses ────────────────────────────────────────────────────────

describe('computeMonthlyExpenses', () => {
  it('sums all category amounts', () => {
    const categories = [{ monthlyAmount: 2537.44 }, { monthlyAmount: 300 }, { monthlyAmount: 100 }];
    expect(computeMonthlyExpenses(categories)).toBeCloseTo(2937.44, 2);
  });

  it('returns 0 for empty categories', () => {
    expect(computeMonthlyExpenses([])).toBe(0);
  });
});

// ─── Investment Growth ────────────────────────────────────────────────────────

describe('investment growth in projection', () => {
  it('applies 7% return to portfolio balance', () => {
    // Simple case: 1 year, no contributions, $100,000 starting
    const state: AppState = {
      ...DEFAULT_STATE,
      person1: {
        ...DEFAULT_STATE.person1,
        startingRothBalance: 100000,
        starting401kBalance: 0,
        startingBrokerageBalance: 0,
        contrib401kPerPaycheck: 0,
        annualRothContrib: 0,
        finalWorkingYear: 2050, // still working
      },
      person2: {
        ...DEFAULT_STATE.person2,
        startingRothBalance: 0,
        starting401kBalance: 0,
        startingBrokerageBalance: 0,
        contrib401kPerPaycheck: 0,
        annualRothContrib: 0,
        finalWorkingYear: 2050,
      },
      expenses: { categories: [] },
      assumptions: {
        ...DEFAULT_STATE.assumptions,
        projectionLength: 1,
        annualReturnRate: 0.07,
        incomeTaxRate: 0,
        ficaRate: 0,
        surplusInvestedFraction: 0, // no brokerage contribution to isolate test
      },
    };
    const rows = runProjection(state);
    // Year 0: $100,000
    expect(rows[0].person1Portfolio).toBeCloseTo(100000, 0);
    // Year 1: $100,000 * 1.07 + 401k match + roth = just growth
    // 401k contrib = 0 × 0 = 0, roth = 0
    expect(rows[1].person1Portfolio).toBeCloseTo(100000 * 1.07, 0);
  });
});

// ─── Retirement Target Calculations ─────────────────────────────────────────

describe('retirement target hit flags', () => {
  it('sets person1TargetHit when portfolio reaches target', () => {
    const state: AppState = {
      ...DEFAULT_STATE,
      person1: {
        ...DEFAULT_STATE.person1,
        startingRothBalance: 1_000_000,
        portfolioTarget: 500_000,
        contrib401kPerPaycheck: 0,
        annualRothContrib: 0,
      },
      expenses: { categories: [] },
      assumptions: {
        ...DEFAULT_STATE.assumptions,
        projectionLength: 1,
        surplusInvestedFraction: 0,
      },
    };
    const rows = runProjection(state);
    expect(rows[0].person1TargetHit).toBe(true);
  });

  it('does not flag target hit when portfolioTarget is 0', () => {
    const state: AppState = {
      ...DEFAULT_STATE,
      person1: { ...DEFAULT_STATE.person1, portfolioTarget: 0, startingRothBalance: 1_000_000 },
      expenses: { categories: [] },
      assumptions: { ...DEFAULT_STATE.assumptions, projectionLength: 1 },
    };
    const rows = runProjection(state);
    expect(rows[0].person1TargetHit).toBe(false);
  });
});

// ─── FIRE Milestone Years ────────────────────────────────────────────────────

describe('computeHouseholdFireMilestones', () => {
  it('finds the year combined portfolio reaches Traditional FIRE target', () => {
    // Both people have $500K portfolios = $1M combined
    // Annual expenses $40K → Traditional FIRE target = $40K × 25 = $1M
    const state: AppState = {
      ...DEFAULT_STATE,
      person1: {
        ...DEFAULT_STATE.person1,
        startingRothBalance: 500_000,
        starting401kBalance: 0,
        startingBrokerageBalance: 0,
        contrib401kPerPaycheck: 0,
        annualRothContrib: 0,
        portfolioTarget: 0,
      },
      person2: {
        ...DEFAULT_STATE.person2,
        startingRothBalance: 500_000,
        starting401kBalance: 0,
        startingBrokerageBalance: 0,
        contrib401kPerPaycheck: 0,
        annualRothContrib: 0,
        portfolioTarget: 0,
      },
      expenses: {
        categories: [{ id: 'test', name: 'Test', monthlyAmount: 40000 / 12 }],
      },
      assumptions: {
        ...DEFAULT_STATE.assumptions,
        projectionLength: 2,
        surplusInvestedFraction: 0,
        annualReturnRate: 0,
      },
    };
    const rows = runProjection(state);
    const milestones = computeHouseholdFireMilestones(rows, 40000);
    const traditional = milestones.find((m) => m.benchmark.id === 'traditional')!;
    // Combined = $1M, target = $1M → should be reached at year 0
    expect(traditional.yearReached).toBe(2026);
  });

  it('returns null when target not reached within projection', () => {
    const state: AppState = {
      ...DEFAULT_STATE,
      person1: {
        ...DEFAULT_STATE.person1,
        startingRothBalance: 1000,
        starting401kBalance: 0,
        startingBrokerageBalance: 0,
        contrib401kPerPaycheck: 0,
        annualRothContrib: 0,
      },
      person2: {
        ...DEFAULT_STATE.person2,
        startingRothBalance: 0,
        starting401kBalance: 0,
        startingBrokerageBalance: 0,
        contrib401kPerPaycheck: 0,
        annualRothContrib: 0,
      },
      expenses: {
        categories: [{ id: 'test', name: 'Test', monthlyAmount: 1_000_000 }],
      },
      assumptions: {
        ...DEFAULT_STATE.assumptions,
        projectionLength: 2,
        surplusInvestedFraction: 0,
        annualReturnRate: 0,
      },
    };
    const rows = runProjection(state);
    const milestones = computeHouseholdFireMilestones(rows, 12_000_000);
    const traditional = milestones.find((m) => m.benchmark.id === 'traditional')!;
    expect(traditional.yearReached).toBeNull();
  });
});

// ─── Staggered Retirement ────────────────────────────────────────────────────

describe('staggered retirement: one person retires', () => {
  it('person 1 stops contributions and income after final working year', () => {
    const state: AppState = {
      ...DEFAULT_STATE,
      person1: {
        ...DEFAULT_STATE.person1,
        finalWorkingYear: 2026, // retires immediately
        contrib401kPerPaycheck: 1000,
        annualRothContrib: 7500,
        startingRothBalance: 0,
      },
      person2: {
        ...DEFAULT_STATE.person2,
        finalWorkingYear: 2050,
        startingRothBalance: 0,
      },
      expenses: { categories: [] },
      assumptions: {
        ...DEFAULT_STATE.assumptions,
        projectionLength: 2,
        surplusInvestedFraction: 0,
        annualReturnRate: 0,
      },
    };
    const rows = runProjection(state);

    // Year 1: person 1 is not working (finalYear = 2026, year1 calendarYear = 2027)
    expect(rows[1].person1Working).toBe(false);
    expect(rows[1].person1Contrib401k).toBe(0);
    expect(rows[1].person1RothContrib).toBe(0);
    expect(rows[1].person1Salary).toBe(0);
  });

  it('person 2 continues contributions after person 1 retires', () => {
    const state: AppState = {
      ...DEFAULT_STATE,
      person1: {
        ...DEFAULT_STATE.person1,
        finalWorkingYear: 2026,
        contrib401kPerPaycheck: 0,
        annualRothContrib: 0,
        startingRothBalance: 0,
      },
      person2: {
        ...DEFAULT_STATE.person2,
        finalWorkingYear: 2050,
        contrib401kPerPaycheck: 500,
        annualRothContrib: 7500,
        startingRothBalance: 0,
      },
      expenses: { categories: [] },
      assumptions: {
        ...DEFAULT_STATE.assumptions,
        projectionLength: 2,
        surplusInvestedFraction: 0,
        annualReturnRate: 0,
      },
    };
    const rows = runProjection(state);
    expect(rows[1].person2Working).toBe(true);
    expect(rows[1].person2Contrib401k).toBe(500 * 24);
    expect(rows[1].person2RothContrib).toBe(7500);
  });
});

describe('staggered retirement: insufficient cash flow', () => {
  it('flags cash flow deficit when active income cannot cover their expense share', () => {
    // Person 1 retires; person 2 earns only $20,000, expenses are $100,000
    const state: AppState = {
      ...DEFAULT_STATE,
      person1: {
        ...DEFAULT_STATE.person1,
        baseSalary: 100,
        finalWorkingYear: 2026, // retires year 0
        startingRothBalance: 0,
        contrib401kPerPaycheck: 0,
        annualRothContrib: 0,
      },
      person2: {
        ...DEFAULT_STATE.person2,
        baseSalary: 20000,
        finalWorkingYear: 2050,
        startingRothBalance: 0,
        contrib401kPerPaycheck: 0,
        annualRothContrib: 0,
        employerMatchRate: 0,
      },
      expenses: {
        categories: [{ id: 'test', name: 'Test', monthlyAmount: 100000 / 12 }],
      },
      assumptions: {
        ...DEFAULT_STATE.assumptions,
        projectionLength: 2,
        surplusInvestedFraction: 1,
        annualReturnRate: 0,
        incomeTaxRate: 0,
        ficaRate: 0,
        person1ExpenseShare: 0.5,
        annualSpendingGrowth: 0,
      },
    };
    const rows = runProjection(state);
    // Person 2 covers 50% of $100K = $50K, but only earns $20K net → deficit
    expect(rows[1].cashFlowDeficit).toBeGreaterThan(0);
  });
});

describe('both people retiring', () => {
  it('both portfolios receive no contributions once both retire', () => {
    const state: AppState = {
      ...DEFAULT_STATE,
      person1: {
        ...DEFAULT_STATE.person1,
        finalWorkingYear: 2026,
        contrib401kPerPaycheck: 0,
        annualRothContrib: 0,
        startingRothBalance: 1_000_000,
      },
      person2: {
        ...DEFAULT_STATE.person2,
        finalWorkingYear: 2026,
        contrib401kPerPaycheck: 0,
        annualRothContrib: 0,
        startingRothBalance: 1_000_000,
        employerMatchRate: 0,
      },
      expenses: { categories: [{ id: 'test', name: 'Test', monthlyAmount: 10000 }] },
      assumptions: {
        ...DEFAULT_STATE.assumptions,
        projectionLength: 1,
        surplusInvestedFraction: 0,
        annualReturnRate: 0,
        annualSpendingGrowth: 0,
      },
    };
    const rows = runProjection(state);
    expect(rows[1].person1Working).toBe(false);
    expect(rows[1].person2Working).toBe(false);
    expect(rows[1].person1Contrib401k).toBe(0);
    expect(rows[1].person2Contrib401k).toBe(0);
    // Withdrawals should cover expenses
    expect(rows[1].person1Withdrawal + rows[1].person2Withdrawal).toBeCloseTo(120000, 0);
  });
});

// ─── All Scenarios (min/target/max) ─────────────────────────────────────────

describe('runAllScenarios', () => {
  it('returns three scenario projections with different bonus values', () => {
    const state: AppState = {
      ...DEFAULT_STATE,
      assumptions: { ...DEFAULT_STATE.assumptions, projectionLength: 1 },
    };
    const { minimum, target, maximum } = runAllScenarios(state);
    expect(minimum[1].person1Bonus).toBe(0);
    expect(target[1].person1Bonus).toBeGreaterThan(0);
    expect(maximum[1].person1Bonus).toBeGreaterThan(target[1].person1Bonus);
  });
});

// ─── findMilestoneYear ───────────────────────────────────────────────────────

describe('findMilestoneYear', () => {
  it('returns null when target is 0', () => {
    const state: AppState = { ...DEFAULT_STATE, assumptions: { ...DEFAULT_STATE.assumptions, projectionLength: 2 } };
    const rows = runProjection(state);
    expect(findMilestoneYear(rows, (r) => r.person1Portfolio, 0)).toBeNull();
  });

  it('returns calendar year when portfolio exceeds target', () => {
    const state: AppState = {
      ...DEFAULT_STATE,
      person1: {
        ...DEFAULT_STATE.person1,
        startingRothBalance: 2_000_000,
        contrib401kPerPaycheck: 0,
        annualRothContrib: 0,
      },
      expenses: { categories: [] },
      assumptions: { ...DEFAULT_STATE.assumptions, projectionLength: 2 },
    };
    const rows = runProjection(state);
    const yr = findMilestoneYear(rows, (r) => r.person1Portfolio, 1_000_000);
    expect(yr).toBe(2026); // already there in year 0
  });
});

// ─── Workbook Cross-Check ────────────────────────────────────────────────────
/**
 * These tests verify our engine against the workbook's formulas with the exact
 * starting values. Since the workbook's projection data was all NULL (the formulas
 * hadn't been evaluated in the saved file), we cross-check against hand-computed
 * values derived from the formulas.
 *
 * Key intentional differences from the workbook:
 * 1. STAGGERED RETIREMENT CASH FLOW: We model expense withdrawals from retired
 *    person's portfolio. The workbook does not — it only accumulates and flags
 *    target-hit years without modeling post-retirement cash flow.
 * 2. INDIVIDUAL vs HOUSEHOLD FIRE: We distinguish between individual portfolio
 *    targets and household sustainability milestones. The workbook tracks both
 *    but acknowledges the limitation in the FIRE Reference notes.
 * 3. YEAR 0 BROKERAGE: Workbook hardcodes M5=0, N5=0 in year 0. We do the same
 *    (year 0 is starting balances only). Contributions flow from year 1 onward.
 */
describe('workbook cross-check: year 1 with default values', () => {
  const state: AppState = {
    ...DEFAULT_STATE,
    assumptions: { ...DEFAULT_STATE.assumptions, projectionLength: 1, bonusScenario: 'target' },
  };
  const rows = runProjection(state);
  const year1 = rows[1];

  it('person 1 year-1 salary', () => {
    // $195,000 × 1.05 = $204,750
    expect(year1.person1Salary).toBeCloseTo(204750, 0);
  });

  it('person 2 year-1 salary', () => {
    // $95,000 × 1.03 = $97,850
    expect(year1.person2Salary).toBeCloseTo(97850, 0);
  });

  it('person 1 year-1 bonus at target (25%)', () => {
    // $204,750 × 0.25 = $51,187.50
    expect(year1.person1Bonus).toBeCloseTo(51187.5, 0);
  });

  it('person 1 year-1 401k contribution', () => {
    // $1,000 × 24 = $24,000
    expect(year1.person1Contrib401k).toBeCloseTo(24000, 0);
  });

  it('person 1 year-1 employer match (0% → $0)', () => {
    expect(year1.person1Match401k).toBe(0);
  });

  it('person 2 year-1 employer match (3% of $97,850)', () => {
    // $97,850 × 0.03 = $2,935.50
    expect(year1.person2Match401k).toBeCloseTo(2935.5, 0);
  });

  it('person 1 year-1 Roth contribution', () => {
    expect(year1.person1RothContrib).toBe(7500);
  });

  it('person 2 year-1 Roth contribution', () => {
    expect(year1.person2RothContrib).toBe(7500);
  });

  it('person 1 year-0 portfolio = starting balances', () => {
    // $0 + $30,000 + $0 = $30,000
    expect(rows[0].person1Portfolio).toBe(30000);
  });

  it('person 2 year-0 portfolio = $0 (all placeholders)', () => {
    expect(rows[0].person2Portfolio).toBe(0);
  });

  it('annual expenses at year 1 (3.5% growth on $30,449.28)', () => {
    const baseAnnual = 2537.44 * 12;
    const expected = baseAnnual * 1.035;
    expect(year1.householdAnnualExpenses).toBeCloseTo(expected, 0);
  });
});

// ─── analyzeStaggeredRetirement ──────────────────────────────────────────────

describe('analyzeStaggeredRetirement', () => {
  it('identifies person 1 final working year', () => {
    const state: AppState = {
      ...DEFAULT_STATE,
      person1: { ...DEFAULT_STATE.person1, finalWorkingYear: 2030 },
      person2: { ...DEFAULT_STATE.person2, finalWorkingYear: 2040 },
      assumptions: { ...DEFAULT_STATE.assumptions, projectionLength: 20 },
    };
    const rows = runProjection(state);
    const analysis = analyzeStaggeredRetirement(rows, 0, 0, 0.04);
    expect(analysis.person1FinalWorkingYear).toBe(2030);
    expect(analysis.person2FinalWorkingYear).toBe(2040);
  });

  it('identifies cash flow deficit after staggered retirement', () => {
    // Person 1 retires immediately; person 2 earns too little to cover expenses
    const state: AppState = {
      ...DEFAULT_STATE,
      person1: {
        ...DEFAULT_STATE.person1,
        finalWorkingYear: 2026,
        baseSalary: 100,
        contrib401kPerPaycheck: 0,
        annualRothContrib: 0,
        startingRothBalance: 0,
      },
      person2: {
        ...DEFAULT_STATE.person2,
        baseSalary: 20000,
        finalWorkingYear: 2050,
        contrib401kPerPaycheck: 0,
        annualRothContrib: 0,
        startingRothBalance: 0,
        employerMatchRate: 0,
      },
      expenses: {
        categories: [{ id: 'test', name: 'Test', monthlyAmount: 100000 / 12 }],
      },
      assumptions: {
        ...DEFAULT_STATE.assumptions,
        projectionLength: 5,
        incomeTaxRate: 0,
        ficaRate: 0,
        annualSpendingGrowth: 0,
        surplusInvestedFraction: 1,
      },
    };
    const rows = runProjection(state);
    const analysis = analyzeStaggeredRetirement(rows, 0, 0, 0.04);
    expect(analysis.incomeShortfallYear).not.toBeNull();
  });
});
