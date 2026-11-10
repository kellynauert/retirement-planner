import { useMemo } from 'react';
import type { FutureMortgageInputs, HouseholdExpenses, MortgageInputs } from '../../engine/types';
import { monthlyMortgagePayment, simulateMortgage } from '../../engine/mortgage';
import { formatCurrency } from '../../engine/formatters';
import { Card } from '../Layout/Card';
import { FormField, NumericInput } from '../Layout/FormField';

function money(value: string): number {
  const n = parseFloat(value.replace(/,/g, ''));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function percent(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? Math.max(0, n / 100) : 0;
}

function years(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

interface MortgageSectionProps {
  expenses: HouseholdExpenses;
  mortgage: MortgageInputs;
  futureMortgage: FutureMortgageInputs;
  projectionStartYear: number;
  projectionLength: number;
  spendingGrowthRate: number;
  onUpdateMortgage: (updates: Partial<MortgageInputs>) => void;
  onUpdateFutureMortgage: (updates: Partial<FutureMortgageInputs>) => void;
}

export function MortgageSection({
  expenses,
  mortgage,
  futureMortgage,
  projectionStartYear,
  projectionLength,
  spendingGrowthRate,
  onUpdateMortgage,
  onUpdateFutureMortgage,
}: MortgageSectionProps) {
  const flatMonthly = expenses.categories.find((c) => c.id === 'mortgage')?.monthlyAmount ?? 0;
  const sim = useMemo(
    () =>
      simulateMortgage({
        projectionStartYear,
        yearCount: projectionLength + 1,
        mortgage,
        future: futureMortgage,
        flatMonthlyPayment: flatMonthly,
        spendingGrowthRate,
      }),
    [projectionStartYear, projectionLength, mortgage, futureMortgage, flatMonthly, spendingGrowthRate],
  );

  const payment = sim.contractualPayment + mortgage.extraMonthlyPayment;
  const usingLoan = mortgage.currentBalance > 0;

  return (
    <Card
      title="Mortgage"
      subtitle="Enter the remaining balance to see a payoff year. Until then, the Mortgage / Rent line is a flat bill with no payoff."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormField label="Remaining balance" hint="Principal you still owe today.">
          <NumericInput prefix="$" value={mortgage.currentBalance || ''} placeholder="0" onCommit={(v) => onUpdateMortgage({ currentBalance: money(v) })} />
        </FormField>
        <FormField label="Interest rate">
          <NumericInput suffix="%" value={(mortgage.annualInterestRate * 100).toFixed(2)} onCommit={(v) => onUpdateMortgage({ annualInterestRate: percent(v) })} />
        </FormField>
        <FormField label="Years left on the loan">
          <NumericInput value={mortgage.remainingTermYears} inputMode="decimal" onCommit={(v) => onUpdateMortgage({ remainingTermYears: years(v) })} />
        </FormField>
        <FormField label="Extra principal per month">
          <NumericInput prefix="$" value={mortgage.extraMonthlyPayment || ''} placeholder="0" onCommit={(v) => onUpdateMortgage({ extraMonthlyPayment: money(v) })} />
        </FormField>
        <FormField label="Principal already paid down" hint="Equity from payments made before this plan. It reduces the next mortgage.">
          <NumericInput prefix="$" value={mortgage.principalAlreadyPaid || ''} placeholder="0" onCommit={(v) => onUpdateMortgage({ principalAlreadyPaid: money(v) })} />
        </FormField>
        <FormField label="Tax, insurance, and HOA" hint="Keeps going after payoff and rises with spending growth. Leave at 0 if those are already listed below.">
          <NumericInput prefix="$" suffix="/mo" value={mortgage.monthlyEscrow || ''} placeholder="0" onCommit={(v) => onUpdateMortgage({ monthlyEscrow: money(v) })} />
        </FormField>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Monthly principal & interest" value={usingLoan ? formatCurrency(payment) : 'Set a balance'} />
        <Stat label="Payoff year" value={sim.currentPayoffYear ? String(sim.currentPayoffYear) : sim.rolledOver ? `Rolls into ${futureMortgage.startYear}` : '—'} />
        <Stat label="Balance at payoff" value={usingLoan ? formatCurrency(0) : formatCurrency(flatMonthly) + '/mo flat'} />
      </div>

      <div className="mt-6 pt-5 border-t border-gray-800">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-sm font-medium text-white">Next mortgage</div>
            <div className="text-xs text-gray-500">Principal paid off on the current loan comes off the purchase price.</div>
          </div>
          <button
            type="button"
            onClick={() => onUpdateFutureMortgage({ enabled: !futureMortgage.enabled })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${futureMortgage.enabled ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300'}`}
          >
            {futureMortgage.enabled ? 'On' : 'Off'}
          </button>
        </div>

        {futureMortgage.enabled && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField label="Start year">
                <NumericInput
                  value={futureMortgage.startYear}
                  inputMode="numeric"
                  onCommit={(v) => onUpdateFutureMortgage({ startYear: Math.round(years(v)) || projectionStartYear })}
                />
              </FormField>
              <FormField label="Purchase price" hint="The new loan is this price minus principal you have paid off.">
                <NumericInput prefix="$" value={futureMortgage.purchasePrice || ''} placeholder="0" onCommit={(v) => onUpdateFutureMortgage({ purchasePrice: money(v) })} />
              </FormField>
              <FormField label="New interest rate">
                <NumericInput suffix="%" value={(futureMortgage.annualInterestRate * 100).toFixed(2)} onCommit={(v) => onUpdateFutureMortgage({ annualInterestRate: percent(v) })} />
              </FormField>
              <FormField label="New term">
                <NumericInput suffix="yrs" value={futureMortgage.termYears} onCommit={(v) => onUpdateFutureMortgage({ termYears: years(v) })} />
              </FormField>
              <FormField label="Extra principal on the new loan">
                <NumericInput prefix="$" value={futureMortgage.extraMonthlyPayment || ''} placeholder="0" onCommit={(v) => onUpdateFutureMortgage({ extraMonthlyPayment: money(v) })} />
              </FormField>
            </div>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Stat label="Principal applied" value={formatCurrency(sim.equityApplied)} />
              <Stat label="New loan amount" value={futureMortgage.purchasePrice > 0 ? formatCurrency(sim.futureStartingBalance) : 'Set a price'} />
              <Stat
                label="New payoff year"
                value={
                  sim.futurePayoffYear
                    ? String(sim.futurePayoffYear)
                    : sim.futureStartingBalance <= 0 && futureMortgage.purchasePrice > 0
                      ? 'No loan needed'
                      : '—'
                }
              />
            </div>
            {futureMortgage.purchasePrice > 0 && sim.futureContractualPayment > 0 && (
              <div className="mt-3 text-xs text-gray-500">
                New payment {formatCurrency(monthlyMortgagePayment(sim.futureStartingBalance, futureMortgage.annualInterestRate, futureMortgage.termYears) + futureMortgage.extraMonthlyPayment)} / month.
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 min-w-0">
      <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">{label}</div>
      <div className="text-lg font-semibold text-white break-words">{value}</div>
    </div>
  );
}
