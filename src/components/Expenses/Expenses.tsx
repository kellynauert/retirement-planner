import { useMemo, useState } from 'react';
import { Plus, Trash2, Info } from 'lucide-react';
import type { ExpenseCategory, FutureMortgageInputs, HouseholdExpenses, MortgageInputs } from '../../engine/types';
import { simulateMortgage } from '../../engine/mortgage';
import { PageHeader } from '../Layout/PageHeader';
import { Card } from '../Layout/Card';
import { FormField, NumericInput } from '../Layout/FormField';
import { formatCurrency } from '../../engine/formatters';
import { MortgageSection } from './MortgageSection';

const LOCKED_IDS = new Set([
  'mortgage', 'utilities', 'groceries', 'transportation', 'insurance',
  'debt', 'childcare', 'dining', 'entertainment', 'travel',
  'subscriptions', 'clothing', 'gifts', 'other',
]);

interface ExpensesProps {
  expenses: HouseholdExpenses;
  mortgage: MortgageInputs;
  futureMortgage: FutureMortgageInputs;
  projectionStartYear: number;
  projectionLength: number;
  spendingGrowthRate: number;
  onUpdateExpenses: (expenses: HouseholdExpenses) => void;
  onUpdateSpendingGrowth: (rate: number) => void;
  onUpdateMortgage: (updates: Partial<MortgageInputs>) => void;
  onUpdateFutureMortgage: (updates: Partial<FutureMortgageInputs>) => void;
}

export function Expenses({
  expenses,
  mortgage,
  futureMortgage,
  projectionStartYear,
  projectionLength,
  spendingGrowthRate,
  onUpdateExpenses,
  onUpdateSpendingGrowth,
  onUpdateMortgage,
  onUpdateFutureMortgage,
}: ExpensesProps) {
  const [newRequired, setNewRequired] = useState('');
  const [newOptional, setNewOptional] = useState('');

  const housing = useMemo(() => {
    const sim = simulateMortgage({
      projectionStartYear,
      yearCount: 1,
      mortgage,
      future: futureMortgage,
      flatMonthlyPayment: expenses.categories.find((c) => c.id === 'mortgage')?.monthlyAmount ?? 0,
      spendingGrowthRate,
    });
    return sim.years[0];
  }, [expenses.categories, mortgage, futureMortgage, projectionStartYear, spendingGrowthRate]);

  const loanReplacesFlat = housing.loan !== 'flat';
  const required = expenses.categories.filter((c) => !c.optional && !(loanReplacesFlat && c.id === 'mortgage'));
  const optional = expenses.categories.filter((c) => c.optional);

  const requiredMonthly =
    expenses.categories
      .filter((c) => !c.optional && c.id !== 'mortgage')
      .reduce((s, c) => s + c.monthlyAmount, 0) +
    (housing.loanPayment + housing.escrow) / 12;
  const optionalMonthly = optional.reduce((s, c) => s + c.monthlyAmount, 0);
  const totalMonthly = requiredMonthly + optionalMonthly;
  const totalAnnual = totalMonthly * 12;

  function updateCategory(id: string, monthlyAmount: number) {
    onUpdateExpenses({
      categories: expenses.categories.map((c) => (c.id === id ? { ...c, monthlyAmount } : c)),
    });
  }

  function removeCategory(id: string) {
    onUpdateExpenses({ categories: expenses.categories.filter((c) => c.id !== id) });
  }

  function addCategory(name: string, isOptional: boolean) {
    if (!name.trim()) return;
    const id = `custom_${Date.now()}`;
    onUpdateExpenses({
      categories: [...expenses.categories, { id, name: name.trim(), monthlyAmount: 0, optional: isOptional }],
    });
  }

  return (
    <div>
      <PageHeader
        title="Household Expenses"
        description="Enter monthly amounts for each category. Both required and optional expenses flow into the projection. Any income surplus after all expenses, taxes, and retirement contributions is tracked separately."
      />
      <div className="p-8 space-y-6">
        <div className="flex items-start gap-3 bg-blue-950/30 border border-blue-800/40 rounded-xl p-4">
          <Info size={16} className="text-blue-400 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-200">
            Only the mortgage is pre-filled. All other categories default to $0 — enter your actual amounts.
            <strong> Optional expenses</strong> are things you could cut if needed; both sections reduce your investable surplus equally in the model.
          </div>
        </div>

        <MortgageSection
          expenses={expenses}
          mortgage={mortgage}
          futureMortgage={futureMortgage}
          projectionStartYear={projectionStartYear}
          projectionLength={projectionLength}
          spendingGrowthRate={spendingGrowthRate}
          onUpdateMortgage={onUpdateMortgage}
          onUpdateFutureMortgage={onUpdateFutureMortgage}
        />

        {/* Summary totals */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Required / month</div>
            <div className="text-2xl font-bold text-white">{formatCurrency(requiredMonthly)}</div>
            <div className="text-xs text-gray-600 mt-1">{formatCurrency(requiredMonthly * 12)} / yr</div>
          </div>
          <div className="bg-gray-900 border border-amber-900/30 rounded-xl p-5">
            <div className="text-xs text-amber-600 uppercase tracking-wide mb-1">Optional / month</div>
            <div className="text-2xl font-bold text-amber-400">{formatCurrency(optionalMonthly)}</div>
            <div className="text-xs text-gray-600 mt-1">{formatCurrency(optionalMonthly * 12)} / yr</div>
          </div>
          <div className="bg-gray-900 border border-indigo-900/30 rounded-xl p-5">
            <div className="text-xs text-indigo-400 uppercase tracking-wide mb-1">Total / month</div>
            <div className="text-2xl font-bold text-indigo-300">{formatCurrency(totalMonthly)}</div>
            <div className="text-xs text-gray-600 mt-1">{formatCurrency(totalAnnual)} / yr</div>
          </div>
        </div>

        {/* Required expenses */}
        <Card
          title="Required Expenses"
          subtitle={
            loanReplacesFlat
              ? 'The mortgage payment now comes from the loan above and drops out after payoff.'
              : 'Fixed obligations. The Mortgage / Rent line is a flat bill until you enter a loan balance.'
          }
        >
          <div className="space-y-2">
            {required.map((cat) => (
              <ExpenseCategoryRow
                key={cat.id}
                category={cat}
                onChange={(amount) => updateCategory(cat.id, amount)}
                onRemove={!LOCKED_IDS.has(cat.id) ? () => removeCategory(cat.id) : undefined}
              />
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={newRequired}
              onChange={(e) => setNewRequired(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { addCategory(newRequired, false); setNewRequired(''); } }}
              placeholder="Add required expense..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
            />
            <button
              onClick={() => { addCategory(newRequired, false); setNewRequired(''); }}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </Card>

        {/* Optional expenses */}
        <Card title="Optional Expenses" subtitle="Lifestyle spending you could reduce or cut — dining, travel, entertainment.">
          <div className="space-y-2">
            {optional.map((cat) => (
              <ExpenseCategoryRow
                key={cat.id}
                category={cat}
                onChange={(amount) => updateCategory(cat.id, amount)}
                onRemove={!LOCKED_IDS.has(cat.id) ? () => removeCategory(cat.id) : undefined}
                accent
              />
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={newOptional}
              onChange={(e) => setNewOptional(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { addCategory(newOptional, true); setNewOptional(''); } }}
              placeholder="Add optional expense..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-600"
            />
            <button
              onClick={() => { addCategory(newOptional, true); setNewOptional(''); }}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </Card>

        {/* Spending growth assumption */}
        <Card title="Annual Spending Growth">
          <FormField
            label="Annual spending inflation rate"
            hint="Applied to all expense categories uniformly each year. The workbook default is 3.5%."
          >
            <NumericInput
              suffix="%"
              value={(spendingGrowthRate * 100).toFixed(1)}
              onCommit={(v) => {
                const n = parseFloat(v);
                if (!isNaN(n)) onUpdateSpendingGrowth(n / 100);
              }}
            />
          </FormField>
          <div className="mt-3 text-xs text-gray-500">
            At {(spendingGrowthRate * 100).toFixed(1)}% annual growth, today's{' '}
            {formatCurrency(totalAnnual)} in annual expenses becomes{' '}
            {formatCurrency(totalAnnual * Math.pow(1 + spendingGrowthRate, 10))} in 10 years and{' '}
            {formatCurrency(totalAnnual * Math.pow(1 + spendingGrowthRate, 20))} in 20 years.
          </div>
        </Card>
      </div>
    </div>
  );
}

function ExpenseCategoryRow({
  category,
  onChange,
  onRemove,
  accent = false,
}: {
  category: ExpenseCategory;
  onChange: (amount: number) => void;
  onRemove?: () => void;
  accent?: boolean;
}) {
  const [local, setLocal] = useState<string | null>(null);
  const display = local !== null ? local : (category.monthlyAmount || '');
  const focusBorder = accent ? 'focus-within:border-amber-600' : 'focus-within:border-indigo-500';

  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-800/50 last:border-0">
      <div className={`flex-1 text-sm ${accent ? 'text-amber-200/80' : 'text-gray-300'}`}>{category.name}</div>
      {category.note && <div className="text-xs text-gray-600 hidden lg:block">{category.note}</div>}
      <div className="w-36">
        <div className={`flex rounded-lg overflow-hidden border border-gray-700 ${focusBorder}`}>
          <span className="flex items-center px-2 bg-gray-800 text-gray-500 text-sm border-r border-gray-700">$</span>
          <input
            type="text"
            inputMode="decimal"
            value={display}
            placeholder="0"
            onChange={(e) => setLocal(e.target.value)}
            onBlur={() => {
              const v = parseFloat(local ?? '');
              onChange(isNaN(v) ? 0 : v);
              setLocal(null);
            }}
            className="flex-1 bg-gray-800 text-white px-2 py-1.5 text-sm outline-none min-w-0"
          />
          <span className="flex items-center px-2 bg-gray-800 text-gray-500 text-xs border-l border-gray-700">/mo</span>
        </div>
      </div>
      <div className="text-xs text-gray-500 w-20 text-right">
        {formatCurrency(category.monthlyAmount * 12)}/yr
      </div>
      {onRemove ? (
        <button onClick={onRemove} className="text-gray-600 hover:text-red-400 transition-colors p-1">
          <Trash2 size={14} />
        </button>
      ) : (
        <div className="w-6" />
      )}
    </div>
  );
}
