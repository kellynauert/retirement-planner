/**
 * Default values derived directly from the workbook.
 * Notes flag values that are placeholders (e.g., "$0 = not yet entered").
 */

import type { AppState, FireBenchmark } from './types';

export const DEFAULT_STATE: AppState = {
  person1: {
    baseSalary: 195000,
    salaryGrowthRate: 0.05,
    minBonusPct: 0.0,
    targetBonusPct: 0.25,
    maxBonusPct: 0.5,
    paychecksPerYear: 24,
    // $1,000/paycheck × 24 = $24,000/year
    contrib401kPerPaycheck: 1000,
    // 0% match — PLACEHOLDER: "Enter actual plan match"
    employerMatchRate: 0,
    annualRothContrib: 7500,
    // PLACEHOLDER: "Replace with current statement balance"
    starting401kBalance: 0,
    // Previously reported approximate balance; verify with statement
    startingRothBalance: 30000,
    // PLACEHOLDER: set to 0 if none
    startingBrokerageBalance: 0,
    currentAge: 31,
    finalWorkingYear: 2043,
    // PLACEHOLDER: "Enter your target" — set to 0 until user configures
    portfolioTarget: 0,
  },
  person2: {
    baseSalary: 95000,
    salaryGrowthRate: 0.03,
    // Person 2 has no bonus in the workbook
    minBonusPct: 0,
    targetBonusPct: 0,
    maxBonusPct: 0,
    paychecksPerYear: 24,
    // PLACEHOLDER: "Enter actual amount"
    contrib401kPerPaycheck: 0,
    // 3% match — "Verify against plan"
    employerMatchRate: 0.03,
    annualRothContrib: 7500,
    // PLACEHOLDER: "Replace with current statement balance"
    starting401kBalance: 0,
    // PLACEHOLDER
    startingRothBalance: 0,
    // PLACEHOLDER
    startingBrokerageBalance: 0,
    currentAge: 28,
    finalWorkingYear: 2043,
    // PLACEHOLDER
    portfolioTarget: 0,
  },
  expenses: {
    categories: [
      { id: 'mortgage', name: 'Mortgage / Rent', monthlyAmount: 2537.44, note: 'Known monthly payment' },
      { id: 'utilities', name: 'Utilities', monthlyAmount: 0 },
      { id: 'groceries', name: 'Groceries & household supplies', monthlyAmount: 0 },
      { id: 'transportation', name: 'Transportation', monthlyAmount: 0 },
      { id: 'insurance', name: 'Insurance & medical out-of-pocket', monthlyAmount: 0 },
      { id: 'debt', name: 'Debt payments (excl. mortgage)', monthlyAmount: 0 },
      { id: 'childcare', name: 'Childcare & education', monthlyAmount: 0 },
      { id: 'dining', name: 'Dining & restaurants', monthlyAmount: 0, optional: true },
      { id: 'entertainment', name: 'Entertainment & hobbies', monthlyAmount: 0, optional: true },
      { id: 'travel', name: 'Travel & vacations', monthlyAmount: 0, optional: true },
      { id: 'subscriptions', name: 'Subscriptions & memberships', monthlyAmount: 0, optional: true },
      { id: 'clothing', name: 'Clothing & personal care', monthlyAmount: 0, optional: true },
      { id: 'gifts', name: 'Gifts & charitable giving', monthlyAmount: 0, optional: true },
      { id: 'other', name: 'Other / miscellaneous', monthlyAmount: 0 },
    ],
  },
  mortgage: {
    currentBalance: 0,
    annualInterestRate: 0.065,
    remainingTermYears: 30,
    extraMonthlyPayment: 0,
    principalAlreadyPaid: 0,
    monthlyEscrow: 0,
  },
  futureMortgage: {
    enabled: false,
    startYear: 2036,
    purchasePrice: 0,
    annualInterestRate: 0.065,
    termYears: 30,
    extraMonthlyPayment: 0,
  },
  assumptions: {
    annualReturnRate: 0.07,
    annualSpendingGrowth: 0.035,
    incomeTaxRate: 0.2143,
    ficaRate: 0.0765,
    surplusInvestedFraction: 1.0,
    person1SurplusShare: 0.5,
    person1ExpenseShare: 0.5,
    projectionStartYear: 2026,
    projectionLength: 40,
    planningAge: 90,
    bonusScenario: 'target',
  },
};

export const FIRE_BENCHMARKS: FireBenchmark[] = [
  {
    id: 'lean',
    name: 'Lean FIRE',
    expenseMultiple: 25,
    withdrawalRate: 0.04,
    description:
      'Illustrative 25× benchmark. Lean FIRE is primarily defined by a lower spending level; there is no universal portfolio formula.',
  },
  {
    id: 'traditional',
    name: 'Traditional FIRE',
    expenseMultiple: 25,
    withdrawalRate: 0.04,
    description:
      'Common starting benchmark: 25× annual expenses, corresponding to a 4% initial withdrawal rate.',
  },
  {
    id: 'conservative',
    name: 'Conservative FIRE',
    expenseMultiple: 30,
    withdrawalRate: 1 / 30,
    description: '30× annual expenses; approximately a 3.3% initial withdrawal rate.',
  },
  {
    id: 'fat',
    name: 'Fat FIRE',
    expenseMultiple: 100 / 3,
    withdrawalRate: 0.03,
    description:
      'Illustrative 33.3× benchmark. Higher-spending retirement; common reference range is 30×–40× expenses.',
  },
  {
    id: 'very_conservative',
    name: 'Very Conservative FIRE',
    expenseMultiple: 40,
    withdrawalRate: 0.025,
    description: '40× annual expenses; a 2.5% initial withdrawal-rate reference.',
  },
];
