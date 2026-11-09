import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Download } from 'lucide-react';
import type { AppState, BonusScenario } from '../../engine/types';
import {
  runAllScenarios,
  computeMonthlyExpenses,
  analyzeStaggeredRetirement,
} from '../../engine/calculator';
import { formatCurrency, formatCompact } from '../../engine/formatters';
import { PageHeader } from '../Layout/PageHeader';
import { Card } from '../Layout/Card';
import { Select } from '../Layout/FormField';

interface ProjectionsProps {
  state: AppState;
}

export function Projections({ state }: ProjectionsProps) {
  const [viewScenario, setViewScenario] = useState<BonusScenario>('target');
  const [showTable, setShowTable] = useState(false);
  const [timeRange, setTimeRange] = useState<'all' | '10' | '20' | '30'>('all');

  const { assumptions } = state;

  const { minimum, target, maximum } = useMemo(() => runAllScenarios(state), [state]);

  const activeRows = viewScenario === 'minimum' ? minimum : viewScenario === 'maximum' ? maximum : target;

  const baseAnnual = computeMonthlyExpenses(state.expenses.categories) * 12;

  const staggeredAnalysis = useMemo(
    () =>
      analyzeStaggeredRetirement(
        activeRows,
        state.person1.portfolioTarget,
        state.person2.portfolioTarget,
        0.04,
      ),
    [activeRows, state.person1.portfolioTarget, state.person2.portfolioTarget],
  );

  // Filter by time range
  const filteredRows = useMemo(() => {
    if (timeRange === 'all') return activeRows;
    const years = parseInt(timeRange);
    return activeRows.filter((r) => r.yearsFromNow <= years);
  }, [activeRows, timeRange]);

  // Downsample for charts
  const chartRows = useMemo(
    () => filteredRows.filter((_, i) => i % 2 === 0),
    [filteredRows],
  );

  // For scenario comparison chart (combined portfolio)
  const scenarioChartRows = useMemo(
    () =>
      (timeRange === 'all' ? target : target.filter((r) => r.yearsFromNow <= parseInt(timeRange)))
        .filter((_, i) => i % 2 === 0)
        .map((row) => ({
          year: row.calendarYear,
          min: Math.round(minimum[row.yearsFromNow]?.combinedPortfolio ?? 0),
          target: Math.round(row.combinedPortfolio),
          max: Math.round(maximum[row.yearsFromNow]?.combinedPortfolio ?? 0),
        })),
    [minimum, target, maximum, timeRange],
  );

  function exportCSV() {
    const headers = [
      'Calendar Year',
      'Years From Now',
      'Person 1 Age',
      'Person 2 Age',
      'Person 1 Salary',
      'Person 2 Salary',
      'Person 1 Bonus',
      'Person 1 401k Contrib',
      'Person 1 401k Match',
      'Person 2 401k Contrib',
      'Person 2 401k Match',
      'Person 1 Roth',
      'Person 2 Roth',
      'Person 1 Brokerage',
      'Person 2 Brokerage',
      'Person 1 Portfolio',
      'Person 2 Portfolio',
      'Combined Portfolio',
      'Person 1 Target Hit',
      'Person 2 Target Hit',
      'Annual Expenses',
      'Person 1 Working',
      'Person 2 Working',
      'Monthly Surplus',
      'Person 1 Withdrawal',
      'Person 2 Withdrawal',
      'Cash Flow Deficit',
    ];
    const rows = activeRows.map((r) =>
      [
        r.calendarYear,
        r.yearsFromNow,
        r.person1Age,
        r.person2Age,
        r.person1Salary,
        r.person2Salary,
        r.person1Bonus,
        r.person1Contrib401k,
        r.person1Match401k,
        r.person2Contrib401k,
        r.person2Match401k,
        r.person1RothContrib,
        r.person2RothContrib,
        r.person1BrokerageContrib,
        r.person2BrokerageContrib,
        r.person1Portfolio,
        r.person2Portfolio,
        r.combinedPortfolio,
        r.person1TargetHit ? 'YES' : '',
        r.person2TargetHit ? 'YES' : '',
        r.householdAnnualExpenses,
        r.person1Working ? 'Yes' : 'No',
        r.person2Working ? 'Yes' : 'No',
        r.monthlyDiscretionarySurplus,
        r.person1Withdrawal,
        r.person2Withdrawal,
        r.cashFlowDeficit,
      ].join(','),
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `retirement-projection-${viewScenario}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const p1RetireYear = state.person1.finalWorkingYear;
  const p2RetireYear = state.person2.finalWorkingYear;

  return (
    <div>
      <PageHeader
        title="Year-by-Year Projections"
        description="Independent portfolios for each person, staggered retirement cash flow, and scenario comparisons."
      >
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
        >
          <Download size={14} /> Export CSV
        </button>
      </PageHeader>

      <div className="p-8 space-y-6">
        {/* Controls */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Bonus scenario:</span>
            <Select
              value={viewScenario}
              options={[
                { value: 'minimum', label: 'Minimum' },
                { value: 'target', label: 'Target' },
                { value: 'maximum', label: 'Maximum' },
              ]}
              onChange={(e) => setViewScenario(e.target.value as BonusScenario)}
              className="w-36"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Time range:</span>
            <div className="flex gap-1">
              {(['all', '10', '20', '30'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    timeRange === r
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {r === 'all' ? `All ${assumptions.projectionLength}yr` : `${r}yr`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Staggered retirement analysis */}
        <Card title="Staggered Retirement Analysis" subtitle="Three distinct milestones — not interchangeable">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MilestoneBox
              label="Person 1 Final Working Year"
              value={p1RetireYear.toString()}
              sub={`Age ${state.person1.currentAge + (p1RetireYear - assumptions.projectionStartYear)}`}
              color="indigo"
            />
            <MilestoneBox
              label="Person 2 Final Working Year"
              value={p2RetireYear.toString()}
              sub={`Age ${state.person2.currentAge + (p2RetireYear - assumptions.projectionStartYear)}`}
              color="green"
            />
            <MilestoneBox
              label="Both Retired & Household Funded"
              value={staggeredAnalysis.bothRetiredHouseholdFeasible?.toString() ?? 'Not in window'}
              sub="Combined portfolio covers expenses at 4% SWR"
              color={staggeredAnalysis.bothRetiredHouseholdFeasible ? 'amber' : 'neutral'}
            />
          </div>
          {staggeredAnalysis.incomeShortfallYear && (
            <div className="mt-4 p-3 bg-red-950/30 border border-red-800/40 rounded-lg text-sm text-red-300">
              ⚠ Income shortfall detected starting {staggeredAnalysis.incomeShortfallYear}: after one person retires,
              the remaining person's income does not fully cover their share of household expenses. Consider
              portfolio withdrawals, expense reduction, or delayed retirement.
            </div>
          )}
        </Card>

        {/* Combined portfolio chart with scenarios */}
        <Card title="Combined Portfolio — Bonus Scenario Comparison">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={scenarioChartRows} margin={{ top: 5, right: 20, bottom: 0, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="year" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Tooltip
                  formatter={(v: any, n: any) => [formatCurrency(Number(v)), String(n)]}
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
                <Area type="monotone" dataKey="max" name="Maximum bonus" stroke="#f59e0b" fill="#f59e0b22" strokeWidth={1.5} dot={false} />
                <Area type="monotone" dataKey="target" name="Target bonus" stroke="#6366f1" fill="#6366f122" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="min" name="Minimum bonus" stroke="#64748b" fill="#64748b11" strokeWidth={1.5} dot={false} />
                {baseAnnual > 0 && (
                  <ReferenceLine y={baseAnnual * 25} stroke="#10b981" strokeDasharray="6 3" label={{ value: 'Trad. FIRE', fill: '#10b981', fontSize: 10 }} />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Individual portfolio chart */}
        <Card title="Individual Portfolios Over Time" subtitle={`${viewScenario.charAt(0).toUpperCase() + viewScenario.slice(1)} bonus scenario`}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartRows.map((r) => ({ year: r.calendarYear, p1: Math.round(r.person1Portfolio), p2: Math.round(r.person2Portfolio) }))} margin={{ top: 5, right: 20, bottom: 0, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="year" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Tooltip
                  formatter={(v: any, n: any) => [formatCurrency(Number(v)), String(n)]}
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
                {state.person1.portfolioTarget > 0 && (
                  <ReferenceLine y={state.person1.portfolioTarget} stroke="#6366f1" strokeDasharray="4 2" label={{ value: 'P1 Target', fill: '#6366f1', fontSize: 9 }} />
                )}
                {state.person2.portfolioTarget > 0 && (
                  <ReferenceLine y={state.person2.portfolioTarget} stroke="#10b981" strokeDasharray="4 2" label={{ value: 'P2 Target', fill: '#10b981', fontSize: 9 }} />
                )}
                <Area type="monotone" dataKey="p1" name="Person 1" stroke="#6366f1" fill="#6366f122" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="p2" name="Person 2" stroke="#10b981" fill="#10b98122" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Annual income vs expenses chart */}
        <Card title="Annual Income vs. Expenses">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows.map((r) => ({
                year: r.calendarYear,
                income: Math.round(r.person1Salary + r.person2Salary + r.person1Bonus),
                expenses: Math.round(r.householdAnnualExpenses),
              }))} margin={{ top: 5, right: 20, bottom: 0, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="year" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Tooltip
                  formatter={(v: any, n: any) => [formatCurrency(Number(v)), String(n)]}
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
                <Bar dataKey="income" name="Gross income" fill="#6366f1" radius={[2, 2, 0, 0]} />
                <Bar dataKey="expenses" name="Annual expenses" fill="#ef4444" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Annual contributions breakdown chart */}
        <Card title="Annual Contributions by Account Type">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartRows.map((r) => ({
                  year: r.calendarYear,
                  '401k_p1': Math.round(r.person1Contrib401k),
                  'match_p1': Math.round(r.person1Match401k),
                  '401k_p2': Math.round(r.person2Contrib401k),
                  'match_p2': Math.round(r.person2Match401k),
                  'roth_p1': Math.round(r.person1RothContrib),
                  'roth_p2': Math.round(r.person2RothContrib),
                  'brokerage': Math.round(r.person1BrokerageContrib + r.person2BrokerageContrib),
                }))}
                margin={{ top: 5, right: 20, bottom: 0, left: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="year" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Tooltip
                  formatter={(v: any, n: any) => [formatCurrency(Number(v)), String(n)]}
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
                <Bar dataKey="401k_p1" name="P1 401(k)" stackId="a" fill="#6366f1" />
                <Bar dataKey="match_p1" name="P1 Match" stackId="a" fill="#818cf8" />
                <Bar dataKey="401k_p2" name="P2 401(k)" stackId="a" fill="#10b981" />
                <Bar dataKey="match_p2" name="P2 Match" stackId="a" fill="#34d399" />
                <Bar dataKey="roth_p1" name="P1 Roth" stackId="a" fill="#f59e0b" />
                <Bar dataKey="roth_p2" name="P2 Roth" stackId="a" fill="#fbbf24" />
                <Bar dataKey="brokerage" name="Brokerage" stackId="a" fill="#64748b" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Year-by-year table toggle */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => setShowTable(!showTable)}
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {showTable ? 'Hide' : 'Show'} year-by-year table
          </button>
        </div>

        {showTable && (
          <Card noPadding>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-gray-800 sticky top-0 bg-gray-900">
                  <tr>
                    {[
                      'Year', 'P1 Age', 'P2 Age',
                      'P1 Salary', 'P2 Salary', 'Bonus',
                      'P1 401k', 'P1 Match', 'P2 401k', 'P2 Match',
                      'P1 Roth', 'P2 Roth', 'Brokerage',
                      'P1 Portfolio', 'P2 Portfolio', 'Combined',
                      'P1 Target', 'P2 Target',
                      'Expenses', 'P1 Withdrawal', 'P2 Withdrawal', 'Deficit',
                    ].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-gray-500 font-medium whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {filteredRows.map((row) => (
                    <tr
                      key={row.calendarYear}
                      className={`hover:bg-gray-800/30 transition-colors ${
                        row.person1TargetHit || row.person2TargetHit ? 'bg-indigo-950/20' : ''
                      } ${!row.person1Working || !row.person2Working ? 'opacity-80' : ''}`}
                    >
                      <td className="px-3 py-2 font-mono text-white font-medium">{row.calendarYear}</td>
                      <td className="px-3 py-2 text-gray-400">{row.person1Age}</td>
                      <td className="px-3 py-2 text-gray-400">{row.person2Age}</td>
                      <td className="px-3 py-2 text-gray-300">{row.person1Salary > 0 ? formatCompact(row.person1Salary) : '—'}</td>
                      <td className="px-3 py-2 text-gray-300">{row.person2Salary > 0 ? formatCompact(row.person2Salary) : '—'}</td>
                      <td className="px-3 py-2 text-gray-300">{row.person1Bonus > 0 ? formatCompact(row.person1Bonus) : '—'}</td>
                      <td className="px-3 py-2 text-gray-300">{formatCompact(row.person1Contrib401k)}</td>
                      <td className="px-3 py-2 text-gray-300">{formatCompact(row.person1Match401k)}</td>
                      <td className="px-3 py-2 text-gray-300">{formatCompact(row.person2Contrib401k)}</td>
                      <td className="px-3 py-2 text-gray-300">{formatCompact(row.person2Match401k)}</td>
                      <td className="px-3 py-2 text-gray-300">{formatCompact(row.person1RothContrib)}</td>
                      <td className="px-3 py-2 text-gray-300">{formatCompact(row.person2RothContrib)}</td>
                      <td className="px-3 py-2 text-gray-300">{formatCompact(row.person1BrokerageContrib + row.person2BrokerageContrib)}</td>
                      <td className="px-3 py-2 text-indigo-300 font-medium">{formatCompact(row.person1Portfolio)}</td>
                      <td className="px-3 py-2 text-emerald-300 font-medium">{formatCompact(row.person2Portfolio)}</td>
                      <td className="px-3 py-2 text-amber-300 font-medium">{formatCompact(row.combinedPortfolio)}</td>
                      <td className="px-3 py-2">
                        {row.person1TargetHit ? <span className="text-emerald-400 font-bold">YES</span> : <span className="text-gray-700">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        {row.person2TargetHit ? <span className="text-emerald-400 font-bold">YES</span> : <span className="text-gray-700">—</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-400">{formatCompact(row.householdAnnualExpenses)}</td>
                      <td className="px-3 py-2 text-red-400">{row.person1Withdrawal > 0 ? formatCompact(row.person1Withdrawal) : '—'}</td>
                      <td className="px-3 py-2 text-red-400">{row.person2Withdrawal > 0 ? formatCompact(row.person2Withdrawal) : '—'}</td>
                      <td className="px-3 py-2">
                        {row.cashFlowDeficit > 0 ? (
                          <span className="text-red-400">{formatCompact(row.cashFlowDeficit)}</span>
                        ) : (
                          <span className="text-gray-700">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function MilestoneBox({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color: 'indigo' | 'green' | 'amber' | 'neutral';
}) {
  const colorMap = {
    indigo: 'text-indigo-400',
    green: 'text-emerald-400',
    amber: 'text-amber-400',
    neutral: 'text-gray-500',
  };
  return (
    <div className="bg-gray-800/50 rounded-xl p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${colorMap[color]}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}
