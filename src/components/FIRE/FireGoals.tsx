import { useState } from 'react';
import { Info, AlertTriangle } from 'lucide-react';
import type { AppState } from '../../engine/types';

import {
  runProjection,
  computeHouseholdFireMilestones,
} from '../../engine/calculator';
import { formatCurrency, formatCompact, formatPct } from '../../engine/formatters';
import { PageHeader } from '../Layout/PageHeader';
import { Card } from '../Layout/Card';
import { FormField, Input } from '../Layout/FormField';

interface FireGoalsProps {
  state: AppState;
  onUpdatePerson1: (updates: Partial<AppState['person1']>) => void;
  onUpdatePerson2: (updates: Partial<AppState['person2']>) => void;
}

export function FireGoals({ state, onUpdatePerson1, onUpdatePerson2 }: FireGoalsProps) {
  const { person1, person2 } = state;
  const [customWithdrawalRate, setCustomWithdrawalRate] = useState<number>(0.04);

  const rows = runProjection(state);
  const baseAnnual = rows[0]?.householdAnnualExpenses ?? 0;
  const householdMilestones = computeHouseholdFireMilestones(rows, baseAnnual);

  const customHouseholdTarget = baseAnnual > 0 ? baseAnnual / customWithdrawalRate : 0;

  // Per-person individual targets derived from their personal portfolio targets
  const p1Target = person1.portfolioTarget;
  const p2Target = person2.portfolioTarget;

  const p1HitRow = p1Target > 0 ? rows.find((r) => r.person1Portfolio >= p1Target) : null;
  const p2HitRow = p2Target > 0 ? rows.find((r) => r.person2Portfolio >= p2Target) : null;

  return (
    <div>
      <PageHeader
        title="Retirement Goals"
        description="Set individual portfolio targets for each person and reference household FIRE benchmarks."
      />
      <div className="p-8 space-y-6">
        {/* Disclaimer */}
        <div className="flex items-start gap-3 bg-amber-950/30 border border-amber-700/40 rounded-xl p-4">
          <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-200 leading-relaxed">
            <strong>These are planning assumptions, not guaranteed safe withdrawal rates.</strong> FIRE benchmarks
            are heuristics derived from historical market data. Actual outcomes depend on market returns, inflation,
            sequence-of-returns risk, taxes on withdrawals, healthcare costs, and retirement duration. Adjust the
            expense basis before adopting a target.
          </div>
        </div>

        {/* Individual portfolio targets */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card title="Person 1 Individual Target" subtitle="Your personal portfolio goal — independent of Person 2">
            <div className="space-y-4">
              <FormField
                label="Portfolio Target"
                hint="When your individual portfolio reaches this amount, 'Target Hit' is flagged in the projection. This does NOT mean the household can afford for you to retire — see the note below."
              >
                <Input
                  type="number"
                  prefix="$"
                  value={person1.portfolioTarget || ''}
                  placeholder="0"
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    onUpdatePerson1({ portfolioTarget: isNaN(v) ? 0 : v });
                  }}
                />
              </FormField>
              {p1Target > 0 && (
                <div className="text-sm">
                  <div className="flex justify-between text-gray-400">
                    <span>Implied withdrawal rate</span>
                    <span className="text-white">{formatPct(baseAnnual / p1Target, 2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-400 mt-1">
                    <span>Target reached</span>
                    <span className={p1HitRow ? 'text-emerald-400' : 'text-amber-400'}>
                      {p1HitRow ? `${p1HitRow.calendarYear} (age ${p1HitRow.person1Age})` : 'Not in projection window'}
                    </span>
                  </div>
                </div>
              )}
              {p1Target === 0 && (
                <div className="text-xs text-gray-500">
                  Enter a target above. Use the FIRE benchmark table as a reference.
                </div>
              )}
            </div>
          </Card>

          <Card title="Person 2 Individual Target" subtitle="Spouse/partner personal portfolio goal — independent of Person 1">
            <div className="space-y-4">
              <FormField
                label="Portfolio Target"
                hint="Same caveats apply — reaching an individual target is an accumulation milestone, not a household retirement feasibility signal."
              >
                <Input
                  type="number"
                  prefix="$"
                  value={person2.portfolioTarget || ''}
                  placeholder="0"
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    onUpdatePerson2({ portfolioTarget: isNaN(v) ? 0 : v });
                  }}
                />
              </FormField>
              {p2Target > 0 && (
                <div className="text-sm">
                  <div className="flex justify-between text-gray-400">
                    <span>Implied withdrawal rate</span>
                    <span className="text-white">{formatPct(baseAnnual / p2Target, 2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-400 mt-1">
                    <span>Target reached</span>
                    <span className={p2HitRow ? 'text-emerald-400' : 'text-amber-400'}>
                      {p2HitRow ? `${p2HitRow.calendarYear} (age ${p2HitRow.person2Age})` : 'Not in projection window'}
                    </span>
                  </div>
                </div>
              )}
              {p2Target === 0 && (
                <div className="text-xs text-gray-500">
                  Enter a target above. Use the FIRE benchmark table as a reference.
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Important distinction box */}
        <div className="flex items-start gap-3 bg-blue-950/30 border border-blue-800/40 rounded-xl p-4">
          <Info size={16} className="text-blue-400 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-200 leading-relaxed">
            <strong>Three distinct milestones — not interchangeable:</strong>
            <ol className="mt-2 space-y-1 list-decimal list-inside">
              <li>An individual portfolio reaching its personal target (tracked above)</li>
              <li>
                One person retiring while the other's income still covers all household expenses — the remaining person
                is essentially "float" until the household is fully funded
              </li>
              <li>
                Both people retired AND the combined portfolio can cover all household expenses at a sustainable
                withdrawal rate indefinitely
              </li>
            </ol>
            <p className="mt-2">
              Scenario 2 and 3 are modeled in the <strong>Projections</strong> view under the staggered retirement
              analysis.
            </p>
          </div>
        </div>

        {/* FIRE Benchmark table */}
        <Card
          title="FIRE Benchmark Reference"
          subtitle="Household combined portfolio targets based on current annual expenses. These are planning conventions."
        >
          {baseAnnual === 0 ? (
            <div className="text-sm text-gray-500 py-4 text-center">
              Enter monthly expenses to calculate FIRE benchmarks.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-800">
                    <th className="pb-3 text-xs text-gray-500 font-medium">Benchmark</th>
                    <th className="pb-3 text-xs text-gray-500 font-medium text-right">Withdrawal Rate</th>
                    <th className="pb-3 text-xs text-gray-500 font-medium text-right">Expense Multiple</th>
                    <th className="pb-3 text-xs text-gray-500 font-medium text-right">Portfolio Target</th>
                    <th className="pb-3 text-xs text-gray-500 font-medium text-right">Year Reached</th>
                    <th className="pb-3 text-xs text-gray-500 font-medium text-right">Ages</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {householdMilestones.map((m) => (
                    <tr key={m.benchmark.id}>
                      <td className="py-3">
                        <div className="text-white font-medium">{m.benchmark.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{m.benchmark.description}</div>
                      </td>
                      <td className="py-3 text-right text-gray-300">{formatPct(m.benchmark.withdrawalRate, 2)}</td>
                      <td className="py-3 text-right text-gray-300">{m.benchmark.expenseMultiple.toFixed(0)}×</td>
                      <td className="py-3 text-right font-medium text-white">{formatCompact(m.portfolioTarget)}</td>
                      <td className="py-3 text-right">
                        {m.yearReached ? (
                          <span className="text-emerald-400 font-medium">{m.yearReached}</span>
                        ) : (
                          <span className="text-gray-600">Not reached</span>
                        )}
                      </td>
                      <td className="py-3 text-right text-gray-400 text-xs">
                        {m.person1Age && m.person2Age ? `${m.person1Age} / ${m.person2Age}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Custom withdrawal rate */}
        <Card title="Custom Withdrawal Rate Calculator">
          <div className="space-y-4">
            <FormField label="Your target withdrawal rate" hint="Adjust to model more or less conservative scenarios.">
              <Input
                type="number"
                suffix="%"
                value={(customWithdrawalRate * 100).toFixed(2)}
                step={0.1}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v > 0) setCustomWithdrawalRate(v / 100);
                }}
              />
            </FormField>
            {baseAnnual > 0 && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-1">Household portfolio target</div>
                  <div className="text-xl font-bold text-white">{formatCompact(customHouseholdTarget)}</div>
                  <div className="text-xs text-gray-500 mt-1">{formatCurrency(baseAnnual)} / {formatPct(customWithdrawalRate, 2)}</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-1">Year reached (combined portfolio)</div>
                  <div className="text-xl font-bold text-white">
                    {(() => {
                      const hit = rows.find((r) => r.combinedPortfolio >= customHouseholdTarget);
                      return hit ? hit.calendarYear : 'Not reached';
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Disclaimers */}
        <Card title="How to Use These Benchmarks">
          <div className="space-y-3 text-sm text-gray-400 leading-relaxed">
            <p>
              FIRE targets are generally calculated from the annual spending the portfolio must support, not gross
              income. This model uses <strong className="text-white">current annual expenses</strong> as the basis —
              a conservative approach would inflation-adjust your expense estimate to your projected retirement date.
            </p>
            <p>
              The 25× benchmark (4% withdrawal rate) is derived from the Trinity Study. It is a heuristic, not a
              guarantee. Actual outcomes depend on market returns, inflation, sequence-of-returns risk, withdrawal
              tax treatment, healthcare costs in retirement, and retirement duration.
            </p>
            <p>
              Lean FIRE and Fat FIRE describe <em>spending levels</em>, not standardized portfolio formulas. The
              expense multiples shown are illustrative comparisons commonly used in FIRE communities.
            </p>
            <p>
              These figures do not separately account for taxes on withdrawals (traditional 401k / IRA distributions
              are taxable), healthcare coverage changes at retirement, pensions, Social Security income, or major
              one-time costs. Adjust your retirement expense basis to reflect these factors before adopting a target.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
