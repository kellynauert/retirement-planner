import { useState } from 'react';
import { Plus, Trash2, Info } from 'lucide-react';
import type { ExpenseCategory, HouseholdExpenses } from '../../engine/types';
import { PageHeader } from '../Layout/PageHeader';
import { Card } from '../Layout/Card';
import { FormField, NumericInput } from '../Layout/FormField';
import { formatCurrency } from '../../engine/formatters';

interface ExpensesProps {
  expenses: HouseholdExpenses;
  spendingGrowthRate: number;
  onUpdateExpenses: (expenses: HouseholdExpenses) => void;
  onUpdateSpendingGrowth: (rate: number) => void;
}

export function Expenses({ expenses, spendingGrowthRate, onUpdateExpenses, onUpdateSpendingGrowth }: ExpensesProps) {
  const [newName, setNewName] = useState('');

  const totalMonthly = expenses.categories.reduce((s, c) => s + c.monthlyAmount, 0);
  const totalAnnual = totalMonthly * 12;

  function updateCategory(id: string, monthlyAmount: number) {
    onUpdateExpenses({
      categories: expenses.categories.map((c) => (c.id === id ? { ...c, monthlyAmount } : c)),
    });
  }

  function removeCategory(id: string) {
    onUpdateExpenses({ categories: expenses.categories.filter((c) => c.id !== id) });
  }

  function addCategory() {
    if (!newName.trim()) return;
    const id = `custom_${Date.now()}`;
    onUpdateExpenses({
      categories: [...expenses.categories, { id, name: newName.trim(), monthlyAmount: 0 }],
    });
    setNewName('');
  }

  return (
    <div>
      <PageHeader
        title="Household Expenses"
        description="Enter actual monthly amounts for each category. The total flows directly into the projection — no spending target is assumed. Any income surplus after expenses, taxes, and retirement contributions is available to invest."
      />
      <div className="p-8 space-y-6">
        <div className="flex items-start gap-3 bg-blue-950/30 border border-blue-800/40 rounded-xl p-4">
          <Info size={16} className="text-blue-400 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-200">
            Only the mortgage ($2,537.44/month) is pre-filled from the workbook. All other categories default to $0
            — enter your actual amounts. The app does <strong>not</strong> assume money not allocated here is spent;
            unallocated surplus is tracked separately and flows to brokerage accounts.
          </div>
        </div>

        <Card title="Monthly Expense Categories">
          <div className="space-y-2">
            {expenses.categories.map((cat) => (
              <ExpenseCategoryRow
                key={cat.id}
                category={cat}
                onChange={(amount) => updateCategory(cat.id, amount)}
                onRemove={
                  !['mortgage', 'utilities', 'groceries', 'transportation', 'insurance', 'dining', 'subscriptions', 'debt', 'other'].includes(cat.id)
                    ? () => removeCategory(cat.id)
                    : undefined
                }
              />
            ))}
          </div>

          {/* Add custom category */}
          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCategory()}
              placeholder="New expense category name..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
            />
            <button
              onClick={addCategory}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </Card>

        {/* Totals */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Monthly</div>
            <div className="text-2xl font-bold text-white">{formatCurrency(totalMonthly)}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Annual</div>
            <div className="text-2xl font-bold text-white">{formatCurrency(totalAnnual)}</div>
          </div>
        </div>

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
}: {
  category: ExpenseCategory;
  onChange: (amount: number) => void;
  onRemove?: () => void;
}) {
  const [local, setLocal] = useState<string | null>(null);
  const display = local !== null ? local : (category.monthlyAmount || '');

  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-800/50 last:border-0">
      <div className="flex-1 text-sm text-gray-300">{category.name}</div>
      {category.note && <div className="text-xs text-gray-600 hidden lg:block">{category.note}</div>}
      <div className="w-36">
        <div className="flex rounded-lg overflow-hidden border border-gray-700 focus-within:border-indigo-500">
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
