import type { FutureMortgageInputs, MortgageInputs, MortgageLoanPhase } from './types';

export interface MortgageYear {
  calendarYear: number;
  /** Principal, interest, and extra actually paid this year, or the inflated flat bill. */
  loanPayment: number;
  /** Full contractual + extra for a year that still has a balance at year end. */
  scheduledAnnualPayment: number;
  escrow: number;
  endingBalance: number;
  loan: MortgageLoanPhase;
}

export interface MortgageSimulation {
  years: MortgageYear[];
  /** Year the current loan reaches $0, if it is not rolled into a new mortgage first. */
  currentPayoffYear: number | null;
  /** Year the future loan reaches $0. */
  futurePayoffYear: number | null;
  /** Principal applied to the new purchase (already paid + paid down before the start year). */
  equityApplied: number;
  futureStartingBalance: number;
  /** True when the current loan still had a balance on the day the new loan started. */
  rolledOver: boolean;
  contractualPayment: number;
  futureContractualPayment: number;
}

export function monthlyMortgagePayment(principal: number, annualRate: number, termYears: number): number {
  if (principal <= 0 || termYears <= 0) return 0;
  const months = Math.max(1, Math.round(termYears * 12));
  const monthlyRate = annualRate / 12;
  if (monthlyRate <= 0) return principal / months;
  const factor = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * factor) / (factor - 1);
}

function applyMonth(balance: number, annualRate: number, contractual: number, extra: number) {
  if (balance <= 0.01) return { balance: 0, payment: 0 };
  const interest = (balance * Math.max(0, annualRate)) / 12;
  const owed = balance + interest;
  const payment = Math.min(owed, Math.max(0, contractual) + Math.max(0, extra));
  const next = owed - payment;
  return { balance: next <= 0.01 ? 0 : next, payment };
}

export function simulateMortgage(input: {
  projectionStartYear: number;
  yearCount: number;
  mortgage: MortgageInputs;
  future: FutureMortgageInputs;
  /** Legacy flat monthly mortgage, used only until a real balance or a new loan replaces it. */
  flatMonthlyPayment: number;
  spendingGrowthRate: number;
}): MortgageSimulation {
  const { mortgage, future, projectionStartYear, yearCount, spendingGrowthRate } = input;
  const originalBalance = Math.max(0, mortgage.currentBalance);
  let balance = originalBalance;
  let annualRate = mortgage.annualInterestRate;
  let extra = Math.max(0, mortgage.extraMonthlyPayment);
  let contractual = monthlyMortgagePayment(balance, annualRate, mortgage.remainingTermYears);
  let phase: MortgageLoanPhase = balance > 0.01 ? 'current' : 'flat';
  let switched = false;
  let currentPayoffYear: number | null = null;
  let futurePayoffYear: number | null = null;
  let equityApplied = 0;
  let futureStartingBalance = 0;
  let rolledOver = false;
  let futureContractualPayment = 0;

  const years: MortgageYear[] = [];

  for (let n = 0; n < yearCount; n++) {
    const calendarYear = projectionStartYear + n;
    const growth = Math.pow(1 + spendingGrowthRate, n);
    const escrow = Math.max(0, mortgage.monthlyEscrow) * 12 * growth;

    const futureStarts =
      !switched && future.enabled && future.purchasePrice > 0 && calendarYear >= future.startYear;

    if (futureStarts) {
      const paidDown = Math.max(0, originalBalance - balance);
      equityApplied = Math.max(0, mortgage.principalAlreadyPaid) + paidDown;
      futureStartingBalance = Math.max(0, future.purchasePrice - equityApplied);
      rolledOver = balance > 0.01;
      balance = futureStartingBalance;
      annualRate = future.annualInterestRate;
      extra = Math.max(0, future.extraMonthlyPayment);
      contractual = monthlyMortgagePayment(balance, annualRate, future.termYears);
      futureContractualPayment = contractual;
      switched = true;
      phase = balance > 0.01 ? 'future' : 'none';
    }

    const loanThisYear: MortgageLoanPhase = phase;
    let loanPayment = 0;

    if (phase === 'current' || phase === 'future') {
      for (let m = 0; m < 12 && balance > 0.01; m++) {
        const step = applyMonth(balance, annualRate, contractual, extra);
        loanPayment += step.payment;
        balance = step.balance;
      }
      if (balance <= 0.01) {
        balance = 0;
        if (phase === 'current') currentPayoffYear = calendarYear;
        if (phase === 'future') futurePayoffYear = calendarYear;
        phase = 'none';
      }
    } else if (phase === 'flat') {
      loanPayment = Math.max(0, input.flatMonthlyPayment) * 12 * growth;
    }

    const stillOpen = balance > 0.01 && (loanThisYear === 'current' || loanThisYear === 'future');
    years.push({
      calendarYear,
      loanPayment,
      scheduledAnnualPayment: stillOpen ? (contractual + extra) * 12 : 0,
      escrow,
      endingBalance: balance,
      loan: loanThisYear,
    });
  }

  return {
    years,
    currentPayoffYear,
    futurePayoffYear,
    equityApplied,
    futureStartingBalance,
    rolledOver,
    contractualPayment: monthlyMortgagePayment(
      originalBalance,
      mortgage.annualInterestRate,
      mortgage.remainingTermYears,
    ),
    futureContractualPayment,
  };
}

/**
 * Housing cost to include in a FIRE multiple, in today's dollars.
 * A loan that is paid off by the retirement year is left out. Flat bills are not inflated.
 */
export function fireHousingAnnual(
  sim: MortgageSimulation,
  retirementYear: number,
  flatMonthly: number,
  escrowMonthly: number,
): number {
  const escrow = Math.max(0, escrowMonthly) * 12;
  const year =
    sim.years.find((y) => y.calendarYear >= retirementYear) ?? sim.years[sim.years.length - 1];
  if (!year) return escrow;
  if (year.loan === 'flat') return Math.max(0, flatMonthly) * 12 + escrow;
  if (year.loan === 'none' || year.endingBalance <= 1) return escrow;
  return year.scheduledAnnualPayment + escrow;
}
