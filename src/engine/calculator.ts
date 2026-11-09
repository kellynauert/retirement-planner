/**
 * Core financial projection engine.
 *
 * TIMING CONVENTION (matches the workbook):
 * - Year 0 is the current year (projectionStartYear). Portfolio values in year 0 are
 *   starting balances only — no contributions and no growth are applied yet.
 * - In year n ≥ 1, contributions for that year are added, then investment growth is
 *   applied to (prior balance + contributions). This is an end-of-year contribution model.
 *
 * SALARY GROWTH:
 *   salary[n] = baseSalary × (1 + growthRate)^n
 *   The final working year is inclusive: a person works all of year finalWorkingYear
 *   and receives salary, bonus, and contributions in that year.
 *
 * AFTER-TAX SURPLUS FORMULA (matches the workbook's column V):
 *   grossIncome = salary1 + salary2 + bonus1
 *   surplus = MAX(0,
 *     (grossIncome - 401k1_employee - 401k2_employee) × (1 - incomeTaxRate)
 *     − grossIncome × ficaRate
 *     − annualExpenses
 *     − roth1 − roth2
 *   ) × surplusInvestedFraction
 *
 * STAGGERED RETIREMENT EXTENSIONS (not in workbook):
 * When a person is no longer working, their portfolio must fund their share of household
 * expenses. The app models this as an annual withdrawal from the retired person's portfolio.
 * The active person's income funds the remaining household expenses; any surplus still flows
 * to their brokerage account.
 */

import type {
  AppState,
  BonusScenario,
  HouseholdFireMilestone,
  PersonInputs,
  ProjectionRow,
  StaggeredRetirementAnalysis,
} from './types';
import { FIRE_BENCHMARKS } from './defaults';

function getBonusRate(person: PersonInputs, scenario: BonusScenario): number {
  switch (scenario) {
    case 'minimum':
      return person.minBonusPct;
    case 'maximum':
      return person.maxBonusPct;
    default:
      return person.targetBonusPct;
  }
}

function isWorking(
  _calendarYear: number,
  projectionStartYear: number,
  yearsFromNow: number,
  finalWorkingYear: number,
): boolean {
  return projectionStartYear + yearsFromNow <= finalWorkingYear;
}

/** Compute annual salary for year n (yearsFromNow). */
export function computeSalary(baseSalary: number, growthRate: number, yearsFromNow: number): number {
  return baseSalary * Math.pow(1 + growthRate, yearsFromNow);
}

/** Compute annual 401(k) employee contribution. */
export function computeContrib401k(
  person: PersonInputs,
  working: boolean,
): number {
  if (!working) return 0;
  return person.contrib401kPerPaycheck * person.paychecksPerYear;
}

/** Compute annual employer 401(k) match. */
export function computeMatch401k(salary: number, matchRate: number, working: boolean): number {
  if (!working) return 0;
  return salary * matchRate;
}

/** Compute Roth IRA contribution (stops when no longer working). */
export function computeRothContrib(annualContrib: number, working: boolean): number {
  if (!working) return 0;
  return annualContrib;
}

/** Compute annual household expenses with spending inflation applied. */
export function computeAnnualExpenses(
  baseAnnualExpenses: number,
  spendingGrowthRate: number,
  yearsFromNow: number,
): number {
  return baseAnnualExpenses * Math.pow(1 + spendingGrowthRate, yearsFromNow);
}

/**
 * Compute after-tax household cash surplus available to invest in brokerage accounts.
 * This matches the workbook column V formula.
 *
 * Note: FICA is applied to gross income (before 401k deductions) which is correct —
 * employee 401k contributions are still subject to FICA taxes.
 * Income tax is applied to income net of pre-tax 401k contributions (traditional 401k).
 */
interface SurplusParams {
  salary1: number;
  salary2: number;
  bonus1: number;
  contrib401k1: number;
  contrib401k2: number;
  roth1: number;
  roth2: number;
  annualExpenses: number;
  incomeTaxRate: number;
  ficaRate: number;
  surplusInvestedFraction: number;
}

/** Shared intermediate calculations for the both-working surplus formula. */
function computeAnnualSurplusComponents(p: SurplusParams) {
  const grossIncome = p.salary1 + p.salary2 + p.bonus1;
  const incomeAfter401k = grossIncome - p.contrib401k1 - p.contrib401k2;
  const afterTaxIncome = incomeAfter401k * (1 - p.incomeTaxRate);
  const ficaObligation = grossIncome * p.ficaRate;
  const takeHome = afterTaxIncome - ficaObligation;
  const afterExpensesAndRoth = takeHome - p.annualExpenses - p.roth1 - p.roth2;
  return { grossIncome, incomeAfter401k, ficaObligation, takeHome, afterExpensesAndRoth };
}

export function computeAnnualSurplus(params: SurplusParams): number {
  const { afterExpensesAndRoth } = computeAnnualSurplusComponents(params);
  return Math.max(0, afterExpensesAndRoth) * params.surplusInvestedFraction;
}

/**
 * Compute surplus for a staggered retirement scenario where one person has stopped
 * working. The retired person covers their expense share from their portfolio instead
 * of employment income.
 */
function computeSurplusStaggered(params: {
  salary1: number;
  salary2: number;
  bonus1: number;
  contrib401k1: number;
  contrib401k2: number;
  roth1: number;
  roth2: number;
  annualExpenses: number;
  incomeTaxRate: number;
  ficaRate: number;
  surplusInvestedFraction: number;
  person1Working: boolean;
  person2Working: boolean;
  person1ExpenseShare: number;
}): {
  surplus: number;
  rawSurplus: number;
  person1Withdrawal: number;
  person2Withdrawal: number;
  cashFlowDeficit: number;
} {
  const person2ExpenseShare = 1 - params.person1ExpenseShare;

  let person1Withdrawal = 0;
  let person2Withdrawal = 0;
  let cashFlowDeficit = 0;

  if (!params.person1Working && !params.person2Working) {
    person1Withdrawal = params.annualExpenses * params.person1ExpenseShare;
    person2Withdrawal = params.annualExpenses * person2ExpenseShare;
    return { surplus: 0, rawSurplus: 0, person1Withdrawal, person2Withdrawal, cashFlowDeficit: 0 };
  }

  if (!params.person1Working && params.person2Working) {
    person1Withdrawal = params.annualExpenses * params.person1ExpenseShare;

    const gross2 = params.salary2 + 0;
    const afterTax2 =
      (gross2 - params.contrib401k2) * (1 - params.incomeTaxRate) -
      gross2 * params.ficaRate;
    const person2ExpenseObligation = params.annualExpenses * person2ExpenseShare;
    const afterExpenses2 = afterTax2 - person2ExpenseObligation - params.roth2;
    const rawSurplus = Math.max(0, afterExpenses2);
    const surplus = rawSurplus * params.surplusInvestedFraction;

    if (afterTax2 < person2ExpenseObligation) {
      cashFlowDeficit = person2ExpenseObligation - afterTax2;
    }

    return { surplus, rawSurplus, person1Withdrawal, person2Withdrawal: 0, cashFlowDeficit };
  }

  if (params.person1Working && !params.person2Working) {
    person2Withdrawal = params.annualExpenses * person2ExpenseShare;

    const gross1 = params.salary1 + params.bonus1;
    const afterTax1 =
      (gross1 - params.contrib401k1) * (1 - params.incomeTaxRate) -
      gross1 * params.ficaRate;
    const person1ExpenseObligation = params.annualExpenses * params.person1ExpenseShare;
    const afterExpenses1 = afterTax1 - person1ExpenseObligation - params.roth1;
    const rawSurplus = Math.max(0, afterExpenses1);
    const surplus = rawSurplus * params.surplusInvestedFraction;

    if (afterTax1 < person1ExpenseObligation) {
      cashFlowDeficit = person1ExpenseObligation - afterTax1;
    }

    return { surplus, rawSurplus, person1Withdrawal: 0, person2Withdrawal, cashFlowDeficit };
  }

  // Both working — standard surplus calculation
  const { afterExpensesAndRoth } = computeAnnualSurplusComponents(params);
  const rawSurplus = Math.max(0, afterExpensesAndRoth);
  const surplus = rawSurplus * params.surplusInvestedFraction;
  return { surplus, rawSurplus, person1Withdrawal: 0, person2Withdrawal: 0, cashFlowDeficit: 0 };
}

/** Build the annual monthly expenses total from categories. */
export function computeMonthlyExpenses(
  categories: { monthlyAmount: number }[],
): number {
  return categories.reduce((sum, c) => sum + c.monthlyAmount, 0);
}

/**
 * Run the full year-by-year projection.
 * Returns an array of ProjectionRow, one per year from 0 to projectionLength (inclusive).
 */
export function runProjection(state: AppState): ProjectionRow[] {
  const { person1, person2, expenses, assumptions } = state;
  const {
    annualReturnRate,
    annualSpendingGrowth,
    incomeTaxRate,
    ficaRate,
    surplusInvestedFraction,
    person1SurplusShare,
    person1ExpenseShare,
    projectionStartYear,
    projectionLength,
    bonusScenario,
  } = assumptions;

  const baseMonthlyExpenses = computeMonthlyExpenses(expenses.categories);
  const baseAnnualExpenses = baseMonthlyExpenses * 12;

  const person1BonusRate = getBonusRate(person1, bonusScenario);
  // Person 2 has no bonus by design (all bonus rates default to 0)
  // but we still respect the structure for future flexibility
  const person2BonusRate = getBonusRate(person2, bonusScenario);

  const rows: ProjectionRow[] = [];

  // Year 0: starting balances only, no contributions, no growth
  const startPortfolio1 =
    person1.starting401kBalance + person1.startingRothBalance + person1.startingBrokerageBalance;
  const startPortfolio2 =
    person2.starting401kBalance + person2.startingRothBalance + person2.startingBrokerageBalance;

  const year0Expenses = computeAnnualExpenses(baseAnnualExpenses, annualSpendingGrowth, 0);
  const calYear0 = projectionStartYear;
  const p1Working0 = isWorking(calYear0, projectionStartYear, 0, person1.finalWorkingYear);
  const p2Working0 = isWorking(calYear0, projectionStartYear, 0, person2.finalWorkingYear);

  const salary1_0 = p1Working0 ? computeSalary(person1.baseSalary, person1.salaryGrowthRate, 0) : 0;
  const salary2_0 = p2Working0 ? computeSalary(person2.baseSalary, person2.salaryGrowthRate, 0) : 0;

  rows.push({
    yearsFromNow: 0,
    calendarYear: calYear0,
    person1Age: person1.currentAge,
    person2Age: person2.currentAge,
    person1Salary: salary1_0,
    person2Salary: salary2_0,
    person1Bonus: salary1_0 * person1BonusRate,
    person1Contrib401k: 0,
    person1Match401k: 0,
    person2Contrib401k: 0,
    person2Match401k: 0,
    person1RothContrib: 0,
    person2RothContrib: 0,
    person1BrokerageContrib: 0,
    person2BrokerageContrib: 0,
    person1Portfolio: startPortfolio1,
    person2Portfolio: startPortfolio2,
    combinedPortfolio: startPortfolio1 + startPortfolio2,
    person1TargetHit: person1.portfolioTarget > 0 && startPortfolio1 >= person1.portfolioTarget,
    person2TargetHit: person2.portfolioTarget > 0 && startPortfolio2 >= person2.portfolioTarget,
    householdAnnualExpenses: year0Expenses,
    person1Working: p1Working0,
    person2Working: p2Working0,
    annualDiscretionarySurplus: 0,
    annualSurplusBeforeInvest: 0,
    monthlyDiscretionarySurplus: 0,
    person1Withdrawal: 0,
    person2Withdrawal: 0,
    cashFlowDeficit: 0,
  });

  for (let n = 1; n <= projectionLength; n++) {
    const calYear = projectionStartYear + n;
    const prevRow = rows[n - 1];

    const p1Working = isWorking(calYear, projectionStartYear, n, person1.finalWorkingYear);
    const p2Working = isWorking(calYear, projectionStartYear, n, person2.finalWorkingYear);

    const salary1 = p1Working ? computeSalary(person1.baseSalary, person1.salaryGrowthRate, n) : 0;
    const salary2 = p2Working ? computeSalary(person2.baseSalary, person2.salaryGrowthRate, n) : 0;
    const bonus1 = salary1 * person1BonusRate;
    const bonus2 = salary2 * person2BonusRate;

    const contrib401k1 = computeContrib401k(person1, p1Working);
    const match401k1 = computeMatch401k(salary1, person1.employerMatchRate, p1Working);
    const contrib401k2 = computeContrib401k(person2, p2Working);
    const match401k2 = computeMatch401k(salary2, person2.employerMatchRate, p2Working);

    const roth1 = computeRothContrib(person1.annualRothContrib, p1Working);
    const roth2 = computeRothContrib(person2.annualRothContrib, p2Working);

    const annualExpenses = computeAnnualExpenses(baseAnnualExpenses, annualSpendingGrowth, n);

    const { surplus, rawSurplus, person1Withdrawal, person2Withdrawal, cashFlowDeficit } =
      computeSurplusStaggered({
        salary1,
        salary2: salary2 + bonus2,
        bonus1,
        contrib401k1,
        contrib401k2,
        roth1,
        roth2,
        annualExpenses,
        incomeTaxRate,
        ficaRate,
        surplusInvestedFraction,
        person1Working: p1Working,
        person2Working: p2Working,
        person1ExpenseShare,
      });

    const brokerage1 = surplus * person1SurplusShare;
    const brokerage2 = surplus * (1 - person1SurplusShare);

    // Portfolio grows on prior balance + contributions − withdrawals
    const portfolio1 =
      prevRow.person1Portfolio * (1 + annualReturnRate) +
      contrib401k1 +
      match401k1 +
      roth1 +
      brokerage1 -
      person1Withdrawal;

    const portfolio2 =
      prevRow.person2Portfolio * (1 + annualReturnRate) +
      contrib401k2 +
      match401k2 +
      roth2 +
      brokerage2 -
      person2Withdrawal;

    rows.push({
      yearsFromNow: n,
      calendarYear: calYear,
      person1Age: person1.currentAge + n,
      person2Age: person2.currentAge + n,
      person1Salary: salary1,
      person2Salary: salary2,
      person1Bonus: bonus1,
      person1Contrib401k: contrib401k1,
      person1Match401k: match401k1,
      person2Contrib401k: contrib401k2,
      person2Match401k: match401k2,
      person1RothContrib: roth1,
      person2RothContrib: roth2,
      person1BrokerageContrib: brokerage1,
      person2BrokerageContrib: brokerage2,
      person1Portfolio: Math.max(0, portfolio1),
      person2Portfolio: Math.max(0, portfolio2),
      combinedPortfolio: Math.max(0, portfolio1) + Math.max(0, portfolio2),
      person1TargetHit: person1.portfolioTarget > 0 && portfolio1 >= person1.portfolioTarget,
      person2TargetHit: person2.portfolioTarget > 0 && portfolio2 >= person2.portfolioTarget,
      householdAnnualExpenses: annualExpenses,
      person1Working: p1Working,
      person2Working: p2Working,
      annualDiscretionarySurplus: rawSurplus,
      annualSurplusBeforeInvest: surplus,
      monthlyDiscretionarySurplus: rawSurplus / 12,
      person1Withdrawal,
      person2Withdrawal,
      cashFlowDeficit,
    });
  }

  return rows;
}

/**
 * Run projections for all three bonus scenarios simultaneously, returning the rows
 * for each scenario. Useful for chart comparisons.
 */
export function runAllScenarios(state: AppState): {
  minimum: ProjectionRow[];
  target: ProjectionRow[];
  maximum: ProjectionRow[];
} {
  return {
    minimum: runProjection({ ...state, assumptions: { ...state.assumptions, bonusScenario: 'minimum' } }),
    target: runProjection({ ...state, assumptions: { ...state.assumptions, bonusScenario: 'target' } }),
    maximum: runProjection({ ...state, assumptions: { ...state.assumptions, bonusScenario: 'maximum' } }),
  };
}

/**
 * Find the first calendar year where a portfolio first meets or exceeds a target.
 * Returns null if never reached.
 */
export function findMilestoneYear(
  rows: ProjectionRow[],
  getValue: (row: ProjectionRow) => number,
  target: number,
): number | null {
  if (target <= 0) return null;
  for (const row of rows) {
    if (getValue(row) >= target) return row.calendarYear;
  }
  return null;
}

/**
 * Compute FIRE milestones for the household (combined portfolio vs each benchmark).
 * Uses current annual expenses as the base for target calculation — consistent with
 * the workbook. Inflation-adjusted expenses at projected retirement date would give a
 * higher, more conservative target.
 */
export function computeHouseholdFireMilestones(
  rows: ProjectionRow[],
  baseAnnualExpenses: number,
): HouseholdFireMilestone[] {
  return FIRE_BENCHMARKS.map((benchmark) => {
    const portfolioTarget = baseAnnualExpenses * benchmark.expenseMultiple;
    let yearReached: number | null = null;
    let person1Age: number | null = null;
    let person2Age: number | null = null;

    for (const row of rows) {
      if (row.combinedPortfolio >= portfolioTarget) {
        yearReached = row.calendarYear;
        person1Age = row.person1Age;
        person2Age = row.person2Age;
        break;
      }
    }

    return { benchmark, portfolioTarget, yearReached, person1Age, person2Age };
  });
}

/**
 * Compute FIRE milestones for a single person based on their individual portfolio
 * and their configured individual target.
 *
 * Individual portfolio target ≠ household FIRE target. This function tracks when
 * one person's portfolio reaches their personal target — it does NOT indicate the
 * household can afford for that person to retire.
 */
export function computeIndividualFireMilestone(
  rows: ProjectionRow[],
  person: 1 | 2,
  portfolioTarget: number,
  baseAnnualExpenses: number,
): {
  yearReached: number | null;
  ageAtRetirement: number | null;
  fireTargets: { benchmark: (typeof FIRE_BENCHMARKS)[0]; target: number; yearReached: number | null }[];
} {
  const getPortfolio = (row: ProjectionRow) =>
    person === 1 ? row.person1Portfolio : row.person2Portfolio;
  const getAge = (row: ProjectionRow) =>
    person === 1 ? row.person1Age : row.person2Age;

  let yearReached: number | null = null;
  let ageAtRetirement: number | null = null;
  if (portfolioTarget > 0) {
    for (const row of rows) {
      if (getPortfolio(row) >= portfolioTarget) {
        yearReached = row.calendarYear;
        ageAtRetirement = getAge(row);
        break;
      }
    }
  }

  const fireTargets = FIRE_BENCHMARKS.map((benchmark) => {
    const target = baseAnnualExpenses * benchmark.expenseMultiple * (person === 1 ? 0.5 : 0.5);
    let yr: number | null = null;
    for (const row of rows) {
      if (getPortfolio(row) >= target) {
        yr = row.calendarYear;
        break;
      }
    }
    return { benchmark, target, yearReached: yr };
  });

  return { yearReached, ageAtRetirement, fireTargets };
}

/**
 * Analyze staggered retirement feasibility — the three distinct milestones the
 * requirements ask for:
 *
 * 1. Person reaches their individual portfolio target (computed separately per person).
 * 2. Household is cash-flow capable after one person retires (remaining income covers expenses).
 * 3. Both people can retire — combined portfolio covers full household expenses at target rate.
 */
export function analyzeStaggeredRetirement(
  rows: ProjectionRow[],
  _person1Target: number,
  _person2Target: number,
  targetWithdrawalRate: number,
): StaggeredRetirementAnalysis {
  const person1FinalWorkingYear =
    rows.filter((r) => r.person1Working).at(-1)?.calendarYear ?? rows[0].calendarYear;
  const person2FinalWorkingYear =
    rows.filter((r) => r.person2Working).at(-1)?.calendarYear ?? rows[0].calendarYear;

  // Find year person 2 income alone can cover expenses after person 1 retires
  let householdCapableAfterPerson1Retires: number | null = null;
  let incomeShortfallYear: number | null = null;

  for (const row of rows) {
    if (!row.person1Working && row.person2Working) {
      if (row.cashFlowDeficit > 0 && incomeShortfallYear === null) {
        incomeShortfallYear = row.calendarYear;
      }
      if (row.cashFlowDeficit === 0 && householdCapableAfterPerson1Retires === null) {
        householdCapableAfterPerson1Retires = row.calendarYear;
      }
    }
  }

  // Find year both retired AND combined portfolio covers expenses at withdrawal rate
  let bothRetiredHouseholdFeasible: number | null = null;
  for (const row of rows) {
    if (!row.person1Working && !row.person2Working) {
      const requiredPortfolio = row.householdAnnualExpenses / targetWithdrawalRate;
      if (row.combinedPortfolio >= requiredPortfolio) {
        bothRetiredHouseholdFeasible = row.calendarYear;
        break;
      }
    }
  }

  return {
    person1FinalWorkingYear,
    person2FinalWorkingYear,
    householdCapableAfterPerson1Retires,
    bothRetiredHouseholdFeasible,
    incomeShortfallYear,
  };
}
