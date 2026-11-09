/**
 * Core data model types for the retirement planning engine.
 * All monetary values are in nominal dollars; percentages are decimals (0.07 = 7%).
 */

export type BonusScenario = 'minimum' | 'target' | 'maximum';

export interface PersonInputs {
  /** Current annual base salary in dollars */
  baseSalary: number;
  /** Annual salary growth rate (decimal) */
  salaryGrowthRate: number;
  /** Minimum bonus as fraction of base salary */
  minBonusPct: number;
  /** Target bonus as fraction of base salary */
  targetBonusPct: number;
  /** Maximum bonus as fraction of base salary */
  maxBonusPct: number;
  /** Number of paychecks per year (applies to 401k per-paycheck contribution) */
  paychecksPerYear: number;
  /** 401(k) employee contribution per paycheck */
  contrib401kPerPaycheck: number;
  /** Employer 401(k) match rate as fraction of salary */
  employerMatchRate: number;
  /** Annual Roth IRA contribution */
  annualRothContrib: number;
  /** Starting 401(k) balance */
  starting401kBalance: number;
  /** Starting Roth IRA balance */
  startingRothBalance: number;
  /** Starting taxable brokerage balance */
  startingBrokerageBalance: number;
  /** Current age (integer) */
  currentAge: number;
  /** Last calendar year of employment (year where this person works their final full year) */
  finalWorkingYear: number;
  /** Personal retirement portfolio target in dollars (0 = not set) */
  portfolioTarget: number;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  monthlyAmount: number;
  note?: string;
  /** If true, appears in the "Optional" section; false/undefined = required */
  optional?: boolean;
}

export interface HouseholdExpenses {
  categories: ExpenseCategory[];
}

/** Amortizing loan. Principal & interest does not inflate and stops at payoff. */
export interface MortgageInputs {
  /** Remaining principal today */
  currentBalance: number;
  /** Nominal annual interest rate (decimal, 0.065 = 6.5%) */
  annualInterestRate: number;
  /** Years left on the contractual term */
  remainingTermYears: number;
  /** Extra principal paid every month, on top of the contractual payment */
  extraMonthlyPayment: number;
  /**
   * Principal already paid down before the projection starts.
   * Added to simulated paydown when a future mortgage begins.
   */
  principalAlreadyPaid: number;
  /**
   * Property tax, insurance, HOA. Inflates with spending growth and continues
   * after the loan is paid off. Leave at 0 if those are already expense categories.
   */
  monthlyEscrow: number;
}

export interface FutureMortgageInputs {
  enabled: boolean;
  /** Calendar year the new loan starts (January). The current loan ends that month. */
  startYear: number;
  /** Price of the next home. Principal paid off on the current loan reduces this. */
  purchasePrice: number;
  annualInterestRate: number;
  termYears: number;
  extraMonthlyPayment: number;
}

export type MortgageLoanPhase = 'flat' | 'current' | 'future' | 'none';

export interface GlobalAssumptions {
  /** Annual nominal investment return rate (decimal) */
  annualReturnRate: number;
  /** Annual spending growth rate (inflation on expenses, decimal) */
  annualSpendingGrowth: number;
  /** Blended income tax rate (decimal) */
  incomeTaxRate: number;
  /** FICA tax rate (decimal) */
  ficaRate: number;
  /** Fraction of annual surplus invested (1.0 = all surplus goes to brokerage) */
  surplusInvestedFraction: number;
  /** Person 1's share of investable surplus for brokerage (rest goes to person 2) */
  person1SurplusShare: number;
  /** Person 1's share of household expenses (for staggered retirement modeling) */
  person1ExpenseShare: number;
  /** First calendar year of the projection */
  projectionStartYear: number;
  /** Number of years to project */
  projectionLength: number;
  /** Selected bonus scenario for projections */
  bonusScenario: BonusScenario;
}

export interface AppState {
  person1: PersonInputs;
  person2: PersonInputs;
  expenses: HouseholdExpenses;
  mortgage: MortgageInputs;
  futureMortgage: FutureMortgageInputs;
  assumptions: GlobalAssumptions;
}

/** One row in the year-by-year projection table */
export interface ProjectionRow {
  yearsFromNow: number;
  calendarYear: number;
  person1Age: number;
  person2Age: number;

  person1Salary: number;
  person2Salary: number;
  person1Bonus: number;

  person1Contrib401k: number;
  person1Match401k: number;
  person2Contrib401k: number;
  person2Match401k: number;

  person1RothContrib: number;
  person2RothContrib: number;

  person1BrokerageContrib: number;
  person2BrokerageContrib: number;

  person1Portfolio: number;
  person2Portfolio: number;
  combinedPortfolio: number;

  person1TargetHit: boolean;
  person2TargetHit: boolean;

  householdAnnualExpenses: number;

  /** Principal, interest, and extra principal paid this year (or the flat mortgage bill). */
  mortgagePayment: number;
  /** Loan balance at the end of the year. */
  mortgageBalance: number;
  mortgageLoan: MortgageLoanPhase;

  person1Working: boolean;
  person2Working: boolean;

  /**
   * Total discretionary cash surplus before the invested-fraction split.
   * annualSurplusBeforeInvest = annualDiscretionarySurplus * surplusInvestedFraction.
   */
  annualDiscretionarySurplus: number;
  /** Cash surplus flowing to brokerage (= annualDiscretionarySurplus × surplusInvestedFraction) */
  annualSurplusBeforeInvest: number;
  /** Net monthly discretionary surplus (annualDiscretionarySurplus / 12) */
  monthlyDiscretionarySurplus: number;

  /** Person 1 portfolio withdrawal (0 during accumulation; amount once retired) */
  person1Withdrawal: number;
  /** Person 2 portfolio withdrawal (0 during accumulation; amount once retired) */
  person2Withdrawal: number;

  /** Household cash flow deficit if applicable (negative = shortfall not covered by portfolio) */
  cashFlowDeficit: number;
}

/** FIRE benchmark definitions */
export interface FireBenchmark {
  id: string;
  name: string;
  expenseMultiple: number;
  withdrawalRate: number;
  description: string;
}

/** Computed FIRE milestone for the household */
export interface HouseholdFireMilestone {
  benchmark: FireBenchmark;
  portfolioTarget: number;
  /** Calendar year when combined portfolio first reaches target (-1 if not reached) */
  yearReached: number | null;
  /** Person 1 age when reached */
  person1Age: number | null;
  /** Person 2 age when reached */
  person2Age: number | null;
}

/** Per-person individual FIRE milestone */
export interface IndividualFireMilestone {
  person: 1 | 2;
  benchmark: FireBenchmark;
  portfolioTarget: number;
  yearReached: number | null;
  ageAtRetirement: number | null;
}

/** Staggered retirement analysis for one scenario */
export interface StaggeredRetirementAnalysis {
  /** Year person 1 stops working */
  person1FinalWorkingYear: number;
  /** Year person 2 stops working */
  person2FinalWorkingYear: number;
  /**
   * First calendar year where person 1 has retired AND the household is cash-flow
   * sustainable (person 2 income covers expenses, or person 1 portfolio can supplement).
   */
  householdCapableAfterPerson1Retires: number | null;
  /**
   * First calendar year where both have retired AND combined portfolio can support
   * full household expenses at the configured withdrawal rate indefinitely.
   */
  bothRetiredHouseholdFeasible: number | null;
  /** Year household expenses exceed remaining income after person 1 retires */
  incomeShortfallYear: number | null;
}
