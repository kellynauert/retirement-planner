import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import type { AppState } from '../../engine/types';
import { formatCompact, formatCurrency } from '../../engine/formatters';
import { runAllScenarios, computeHouseholdFireMilestones } from '../../engine/calculator';
import { Card, StatCard } from '../Layout/Card';
import { PageHeader } from '../Layout/PageHeader';

interface DashboardProps {
  state: AppState;
}


export function Dashboard({ state }: DashboardProps) {
  const { person1, person2, assumptions } = state;

  const { minimum, target, maximum } = runAllScenarios(state);

  const baseAnnual = target[0]?.householdAnnualExpenses ?? 0;
  const baseMonthly = baseAnnual / 12;

  const fireMilestones = computeHouseholdFireMilestones(target, baseAnnual);
  const traditionalFire = fireMilestones.find((m) => m.benchmark.id === 'traditional');

  // Determine if individual targets are set
  const p1TargetSet = person1.portfolioTarget > 0;
  const p2TargetSet = person2.portfolioTarget > 0;
  const p1TargetRow = p1TargetSet ? target.find((r) => r.person1TargetHit) : null;
  const p2TargetRow = p2TargetSet ? target.find((r) => r.person2TargetHit) : null;

  const currentRow = target[0];
  const year1Row = target[1];
  const monthlySurplus = year1Row?.monthlyDiscretionarySurplus ?? 0;

  // Chart data - downsample to every 2 years for readability
  const chartData = target
    .filter((_, i) => i % 2 === 0)
    .map((row) => {
      const minRow = minimum[row.yearsFromNow];
      const maxRow = maximum[row.yearsFromNow];
      return {
        year: row.calendarYear,
        min: Math.round(minRow?.combinedPortfolio ?? 0),
        target: Math.round(row.combinedPortfolio),
        max: Math.round(maxRow?.combinedPortfolio ?? 0),
        p1: Math.round(row.person1Portfolio),
        p2: Math.round(row.person2Portfolio),
        expenses: Math.round(row.householdAnnualExpenses),
      };
    });

  const householdTarget = traditionalFire?.portfolioTarget ?? 0;

  return (
    <div>
      <PageHeader
        title="Retirement Dashboard"
        description="Household overview based on current inputs. All projections use the target bonus scenario."
      />

      <div className="p-8 space-y-6">

        {/* Key stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Monthly Household Expenses"
            value={formatCurrency(baseMonthly)}
            sub={`${formatCurrency(baseAnnual)} / year`}
            accent="blue"
          />
          <StatCard
            label="Est. Monthly Surplus"
            value={formatCurrency(Math.max(0, monthlySurplus))}
            sub="After expenses, taxes & contributions"
            accent={monthlySurplus > 0 ? 'green' : 'red'}
          />
          <StatCard
            label="Person 1 Starting Portfolio"
            value={formatCompact(currentRow?.person1Portfolio ?? 0)}
            sub={`Target: ${p1TargetSet ? formatCompact(person1.portfolioTarget) : 'Not set'}`}
            accent="indigo"
          />
          <StatCard
            label="Person 2 Starting Portfolio"
            value={formatCompact(currentRow?.person2Portfolio ?? 0)}
            sub={`Target: ${p2TargetSet ? formatCompact(person2.portfolioTarget) : 'Not set'}`}
            accent="green"
          />
        </div>

        {/* Individual retirement targets */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card title="Person 1 Retirement" subtitle={`Age ${person1.currentAge} today · retires ${person1.finalWorkingYear}`}>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Base salary</span>
                <span className="text-white">{formatCurrency(person1.baseSalary)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Target bonus ({(person1.targetBonusPct * 100).toFixed(0)}%)</span>
                <span className="text-white">{formatCurrency(person1.baseSalary * person1.targetBonusPct)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Annual 401(k) contribution</span>
                <span className="text-white">
                  {formatCurrency(person1.contrib401kPerPaycheck * person1.paychecksPerYear)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Annual Roth IRA contribution</span>
                <span className="text-white">{formatCurrency(person1.annualRothContrib)}</span>
              </div>
              <div className="border-t border-gray-800 pt-3">
                {p1TargetSet ? (
                  p1TargetRow ? (
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 size={16} />
                      <span className="text-sm font-medium">
                        Target reached {p1TargetRow.calendarYear} (age {p1TargetRow.person1Age})
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-amber-400">
                      <Clock size={16} />
                      <span className="text-sm">Target not reached in {assumptions.projectionLength}-year window</span>
                    </div>
                  )
                ) : (
                  <div className="text-xs text-gray-500">No individual target set</div>
                )}
              </div>
            </div>
          </Card>

          <Card title="Person 2 Retirement" subtitle={`Age ${person2.currentAge} today · retires ${person2.finalWorkingYear}`}>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Base salary</span>
                <span className="text-white">{formatCurrency(person2.baseSalary)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Annual 401(k) contribution</span>
                <span className="text-white">
                  {formatCurrency(person2.contrib401kPerPaycheck * person2.paychecksPerYear)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Employer match ({(person2.employerMatchRate * 100).toFixed(1)}%)</span>
                <span className="text-white">{formatCurrency(person2.baseSalary * person2.employerMatchRate)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Annual Roth IRA contribution</span>
                <span className="text-white">{formatCurrency(person2.annualRothContrib)}</span>
              </div>
              <div className="border-t border-gray-800 pt-3">
                {p2TargetSet ? (
                  p2TargetRow ? (
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 size={16} />
                      <span className="text-sm font-medium">
                        Target reached {p2TargetRow.calendarYear} (age {p2TargetRow.person2Age})
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-amber-400">
                      <Clock size={16} />
                      <span className="text-sm">Target not reached in {assumptions.projectionLength}-year window</span>
                    </div>
                  )
                ) : (
                  <div className="text-xs text-gray-500">No individual target set</div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* FIRE milestones summary */}
        <Card title="FIRE Milestones" subtitle="Combined household portfolio vs. benchmarks based on current annual expenses">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {fireMilestones.map((m) => (
              <div key={m.benchmark.id} className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">{m.benchmark.name}</div>
                <div className="text-sm font-medium text-white">{formatCompact(m.portfolioTarget)}</div>
                <div className="text-xs mt-1">
                  {m.yearReached ? (
                    <span className="text-emerald-400">{m.yearReached}</span>
                  ) : (
                    <span className="text-gray-600">Not reached</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-600">
            These are accumulation benchmarks using this year's household spending, including this year's
            housing payment. They are planning conventions, not guaranteed safe withdrawal rates. Paying the
            mortgage off later lowers the bills in the projection, but it does not lower these targets. The
            model also does not inflation-adjust expenses to the retirement date.
          </p>
        </Card>

        {/* Portfolio growth chart */}
        <Card title="Combined Portfolio Growth" subtitle="Min / Target / Max bonus scenarios">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 0, left: 10 }}>
                <defs>
                  <linearGradient id="maxGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="targetGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="minGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#64748b" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#64748b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="year" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Tooltip
                  formatter={(value: any, name: any) => [formatCurrency(Number(value)), String(name)]}
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
                {householdTarget > 0 && (
                  <ReferenceLine
                    y={householdTarget}
                    stroke="#10b981"
                    strokeDasharray="6 3"
                    label={{ value: 'Traditional FIRE', fill: '#10b981', fontSize: 11 }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="max"
                  name="Max bonus"
                  stroke="#f59e0b"
                  fill="url(#maxGrad)"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="target"
                  name="Target bonus"
                  stroke="#6366f1"
                  fill="url(#targetGrad)"
                  strokeWidth={2}
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="min"
                  name="Min bonus"
                  stroke="#64748b"
                  fill="url(#minGrad)"
                  strokeWidth={1.5}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Individual portfolio chart */}
        <Card title="Individual Portfolio Growth" subtitle="Person 1 and Person 2 portfolios separately — target bonus scenario">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 0, left: 10 }}>
                <defs>
                  <linearGradient id="p1Grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="p2Grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="year" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Tooltip
                  formatter={(value: any, name: any) => [formatCurrency(Number(value)), String(name)]}
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
                {p1TargetSet && (
                  <ReferenceLine
                    y={person1.portfolioTarget}
                    stroke="#6366f1"
                    strokeDasharray="4 2"
                    label={{ value: 'P1 Target', fill: '#6366f1', fontSize: 10, position: 'insideBottomRight' }}
                  />
                )}
                {p2TargetSet && (
                  <ReferenceLine
                    y={person2.portfolioTarget}
                    stroke="#10b981"
                    strokeDasharray="4 2"
                    label={{ value: 'P2 Target', fill: '#10b981', fontSize: 10, position: 'insideBottomRight' }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="p1"
                  name="Person 1"
                  stroke="#6366f1"
                  fill="url(#p1Grad)"
                  strokeWidth={2}
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="p2"
                  name="Person 2"
                  stroke="#10b981"
                  fill="url(#p2Grad)"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Staggered retirement timeline */}
        <Card title="Retirement Timeline" subtitle="Employment stop dates — these are your configured working years, not calculated milestones">
          <div className="relative">
            <div className="space-y-4">
              <TimelineItem
                label="Person 1 retires"
                year={person1.finalWorkingYear}
                age={person1.currentAge + (person1.finalWorkingYear - assumptions.projectionStartYear)}
                color="indigo"
              />
              <TimelineItem
                label="Person 2 retires"
                year={person2.finalWorkingYear}
                age={person2.currentAge + (person2.finalWorkingYear - assumptions.projectionStartYear)}
                color="green"
              />
              {person1.finalWorkingYear !== person2.finalWorkingYear && (
                <div className="ml-6 pl-4 border-l border-dashed border-gray-700 py-2">
                  <div className="text-xs text-amber-400">
                    <TrendingUp size={12} className="inline mr-1" />
                    Staggered retirement: {Math.abs(person1.finalWorkingYear - person2.finalWorkingYear)}-year gap.
                    During this period, the working person's income covers household expenses. Retirement accounts stay invested until both have stopped working.
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 p-3 bg-gray-800/50 rounded-lg text-xs text-gray-500 leading-relaxed">
            <strong className="text-gray-400">Important distinctions:</strong> (1) An individual portfolio reaching
            its target does <em>not</em> mean the household can afford that person to retire — the remaining person
            must be able to cover household expenses from their income. (2) Both people stopping work requires the
            combined portfolio to sustainably cover all household expenses via withdrawals. These are modeled
            separately in the Projections view.
          </div>
        </Card>
      </div>
    </div>
  );
}

function TimelineItem({
  label,
  year,
  age,
  color,
}: {
  label: string;
  year: number;
  age: number;
  color: 'indigo' | 'green';
}) {
  const colorMap = {
    indigo: { dot: 'bg-indigo-500', text: 'text-indigo-400' },
    green: { dot: 'bg-emerald-500', text: 'text-emerald-400' },
  };
  return (
    <div className="flex items-center gap-4">
      <div className={`w-3 h-3 rounded-full ${colorMap[color].dot} shrink-0`} />
      <div className="text-sm text-gray-300">{label}</div>
      <div className={`ml-auto font-mono font-semibold ${colorMap[color].text}`}>{year}</div>
      <div className="text-xs text-gray-500 w-16 text-right">age {age}</div>
    </div>
  );
}
