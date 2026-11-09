import { useState, useMemo } from 'react';
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
  Label,
} from 'recharts';
import type { AppState } from '../../engine/types';
import {
  runProjection,
  computeMonthlyExpenses,
  computeHouseholdFireMilestones,
} from '../../engine/calculator';
import { formatCurrency, formatCompact } from '../../engine/formatters';
import { PageHeader } from '../Layout/PageHeader';

interface LivePlannerProps {
  state: AppState;
}

const FIRE_COLORS: Record<string, string> = {
  lean: '#94a3b8',
  traditional: '#10b981',
  conservative: '#06b6d4',
  fat: '#f59e0b',
  very_conservative: '#ef4444',
};

export function LivePlanner({ state }: LivePlannerProps) {
  // Local overrides — changes here do NOT persist to global state
  const [p1FinalYear, setP1FinalYear] = useState(state.person1.finalWorkingYear);
  const [p2FinalYear, setP2FinalYear] = useState(state.person2.finalWorkingYear);
  const [surplusPct, setSurplusPct] = useState(
    Math.round(state.assumptions.surplusInvestedFraction * 100),
  );
  const [scenario, setScenario] = useState<'minimum' | 'target' | 'maximum'>('target');

  const startYear = state.assumptions.projectionStartYear;
  const endYear = startYear + state.assumptions.projectionLength;

  // Build a local state with the overridden values
  const localState = useMemo(
    () => ({
      ...state,
      person1: { ...state.person1, finalWorkingYear: p1FinalYear },
      person2: { ...state.person2, finalWorkingYear: p2FinalYear },
      assumptions: {
        ...state.assumptions,
        surplusInvestedFraction: surplusPct / 100,
        bonusScenario: scenario,
      },
    }),
    [state, p1FinalYear, p2FinalYear, surplusPct, scenario],
  );

  const rows = useMemo(() => runProjection(localState), [localState]);

  const baseAnnual = computeMonthlyExpenses(state.expenses.categories) * 12;

  const fireMilestones = useMemo(
    () => computeHouseholdFireMilestones(rows, baseAnnual),
    [rows, baseAnnual],
  );

  // Current year 1 surplus (first full year of contributions)
  const surplusRow = rows[1] ?? rows[0];
  const annualSurplus = surplusRow.annualSurplusBeforeInvest;
  const monthlySurplus = annualSurplus / 12;

  // Chart data - every year
  const chartData = rows.map((row) => ({
    year: row.calendarYear,
    combined: Math.round(row.combinedPortfolio),
    p1: Math.round(row.person1Portfolio),
    p2: Math.round(row.person2Portfolio),
    expenses: Math.round(row.householdAnnualExpenses),
  }));

  // Which FIRE targets are reached?
  const reachedMilestones = fireMilestones.filter((m) => m.yearReached !== null);

  // Tooltip with FIRE info
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const combined = payload.find((p: any) => p.dataKey === 'combined')?.value ?? 0;
    const p1 = payload.find((p: any) => p.dataKey === 'p1')?.value ?? 0;
    const p2 = payload.find((p: any) => p.dataKey === 'p2')?.value ?? 0;

    // Which FIRE milestones does this year hit?
    const hitThisYear = fireMilestones.filter((m) => m.yearReached === label);

    return (
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-xl min-w-56">
        <div className="text-white font-semibold mb-2">{label}</div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between gap-6">
            <span className="text-amber-400">Combined</span>
            <span className="text-white font-medium">{formatCompact(combined)}</span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="text-indigo-400">Person 1</span>
            <span className="text-white">{formatCompact(p1)}</span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="text-emerald-400">Person 2</span>
            <span className="text-white">{formatCompact(p2)}</span>
          </div>
        </div>
        {hitThisYear.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-700 space-y-1">
            {hitThisYear.map((m) => (
              <div key={m.benchmark.id} className="text-xs" style={{ color: FIRE_COLORS[m.benchmark.id] }}>
                ★ {m.benchmark.name} reached!
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <PageHeader
        title="Live Planner"
        description="Adjust key inputs and watch the projection update instantly. Changes here are for exploration only — go to the respective sections to save changes permanently."
      />

      <div className="flex gap-0 h-[calc(100vh-89px)]">
        {/* ── Left panel: controls ── */}
        <div className="w-72 shrink-0 border-r border-gray-800 bg-gray-900 overflow-y-auto p-6 space-y-7">

          {/* Scenario */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Bonus Scenario
            </label>
            <div className="grid grid-cols-3 gap-1">
              {(['minimum', 'target', 'maximum'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setScenario(s)}
                  className={`py-1.5 rounded text-xs font-medium transition-colors capitalize ${
                    scenario === s
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Person 1 final year */}
          <SliderField
            label="Person 1 Retires"
            value={p1FinalYear}
            min={startYear}
            max={endYear}
            step={1}
            format={(v) => v.toString()}
            sub={`Age ${state.person1.currentAge + (p1FinalYear - startYear)}`}
            color="#6366f1"
            onChange={setP1FinalYear}
          />

          {/* Person 2 final year */}
          <SliderField
            label="Person 2 Retires"
            value={p2FinalYear}
            min={startYear}
            max={endYear}
            step={1}
            format={(v) => v.toString()}
            sub={`Age ${state.person2.currentAge + (p2FinalYear - startYear)}`}
            color="#10b981"
            onChange={setP2FinalYear}
          />

          {/* Surplus invested % */}
          <SliderField
            label="% of Surplus Invested"
            value={surplusPct}
            min={0}
            max={100}
            step={5}
            format={(v) => `${v}%`}
            sub="Leftover income going to brokerage"
            color="#f59e0b"
            onChange={setSurplusPct}
          />

          {/* FIRE milestone legend */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              FIRE Target Lines
            </label>
            <div className="space-y-2">
              {fireMilestones.map((m) => (
                <div key={m.benchmark.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-0.5"
                      style={{ backgroundColor: FIRE_COLORS[m.benchmark.id], opacity: 0.8 }}
                    />
                    <span className="text-xs text-gray-400">{m.benchmark.name}</span>
                  </div>
                  <span
                    className="text-xs font-medium tabular-nums"
                    style={{ color: m.yearReached ? FIRE_COLORS[m.benchmark.id] : '#374151' }}
                  >
                    {m.yearReached ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Staggered gap indicator */}
          {p1FinalYear !== p2FinalYear && (
            <div className="p-3 bg-amber-950/40 border border-amber-700/30 rounded-lg">
              <div className="text-xs text-amber-400 font-medium mb-1">Staggered Retirement</div>
              <div className="text-xs text-amber-200/70">
                {Math.abs(p1FinalYear - p2FinalYear)}-year gap.{' '}
                {p1FinalYear < p2FinalYear
                  ? "Person 1 retires first; their portfolio covers their expense share."
                  : "Person 2 retires first; their portfolio covers their expense share."}
              </div>
            </div>
          )}
        </div>

        {/* ── Right panel: surplus + chart ── */}
        <div className="flex-1 overflow-y-auto">

          {/* Big surplus numbers */}
          <div className="grid grid-cols-2 border-b border-gray-800">
            <div className="p-8 border-r border-gray-800">
              <div className="text-xs text-gray-500 uppercase tracking-widest mb-2">
                Annual Surplus Available to Invest
              </div>
              <div
                className={`text-5xl font-bold tabular-nums tracking-tight ${
                  annualSurplus > 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {formatCurrency(Math.max(0, annualSurplus))}
              </div>
              <div className="mt-2 text-sm text-gray-500">
                Year 1 ({startYear + 1}) · {scenario} bonus · {surplusPct}% invested
              </div>
              {annualSurplus <= 0 && (
                <div className="mt-2 text-sm text-red-400">
                  Expenses and contributions exceed after-tax income in year 1.
                </div>
              )}
            </div>
            <div className="p-8">
              <div className="text-xs text-gray-500 uppercase tracking-widest mb-2">
                Monthly Surplus Available to Invest
              </div>
              <div
                className={`text-5xl font-bold tabular-nums tracking-tight ${
                  monthlySurplus > 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {formatCurrency(Math.max(0, monthlySurplus))}
              </div>
              <div className="mt-2 text-sm text-gray-500">per month</div>
              <div className="mt-3 text-xs text-gray-600">
                After taxes, FICA, all expenses, 401(k) contributions, and Roth IRA contributions.
                This is the amount flowing to brokerage accounts.
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="p-6">
            <div className="mb-4">
              <div className="text-sm font-medium text-white">
                Combined Portfolio Growth with FIRE Targets
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Dashed lines show where each FIRE benchmark is reached. Hover for details.
              </div>
            </div>
            <div className="h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 20, right: 24, bottom: 0, left: 10 }}>
                  <defs>
                    <linearGradient id="combinedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="p1Grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="p2Grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: '#6b7280', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#374151' }}
                  />
                  <YAxis
                    tickFormatter={(v) => formatCompact(v)}
                    tick={{ fill: '#6b7280', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={72}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: '#9ca3af', paddingTop: 12 }}
                  />

                  {/* FIRE target horizontal reference lines */}
                  {fireMilestones.map((m) =>
                    baseAnnual > 0 ? (
                      <ReferenceLine
                        key={m.benchmark.id}
                        y={m.portfolioTarget}
                        stroke={FIRE_COLORS[m.benchmark.id]}
                        strokeDasharray="6 4"
                        strokeWidth={1.5}
                        strokeOpacity={0.75}
                      >
                        <Label
                          value={`${m.benchmark.name}${m.yearReached ? ` (${m.yearReached})` : ' (not reached)'}`}
                          position="insideTopRight"
                          style={{
                            fill: FIRE_COLORS[m.benchmark.id],
                            fontSize: 10,
                            opacity: 0.9,
                          }}
                          offset={4}
                        />
                      </ReferenceLine>
                    ) : null,
                  )}

                  {/* Retirement year vertical lines */}
                  <ReferenceLine
                    x={p1FinalYear}
                    stroke="#6366f1"
                    strokeDasharray="4 3"
                    strokeOpacity={0.5}
                  >
                    <Label
                      value={`P1 retires`}
                      position="top"
                      style={{ fill: '#6366f1', fontSize: 10 }}
                    />
                  </ReferenceLine>
                  <ReferenceLine
                    x={p2FinalYear}
                    stroke="#10b981"
                    strokeDasharray="4 3"
                    strokeOpacity={0.5}
                  >
                    <Label
                      value={`P2 retires`}
                      position="top"
                      style={{ fill: '#10b981', fontSize: 10 }}
                    />
                  </ReferenceLine>

                  <Area
                    type="monotone"
                    dataKey="combined"
                    name="Combined"
                    stroke="#f59e0b"
                    fill="url(#combinedGrad)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4, fill: '#f59e0b' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="p1"
                    name="Person 1"
                    stroke="#6366f1"
                    fill="url(#p1Grad)"
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={{ r: 3, fill: '#6366f1' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="p2"
                    name="Person 2"
                    stroke="#10b981"
                    fill="url(#p2Grad)"
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={{ r: 3, fill: '#10b981' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* FIRE milestone summary cards */}
            {reachedMilestones.length > 0 && (
              <div className="mt-6">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                  Milestones reached with current settings
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {fireMilestones.map((m) => (
                    <div
                      key={m.benchmark.id}
                      className="rounded-xl p-3"
                      style={{
                        backgroundColor: m.yearReached
                          ? `${FIRE_COLORS[m.benchmark.id]}18`
                          : '#111827',
                        borderWidth: 1,
                        borderColor: m.yearReached
                          ? `${FIRE_COLORS[m.benchmark.id]}44`
                          : '#1f2937',
                      }}
                    >
                      <div className="text-xs font-medium mb-1" style={{ color: FIRE_COLORS[m.benchmark.id] }}>
                        {m.benchmark.name}
                      </div>
                      <div className="text-sm font-bold text-white">
                        {m.yearReached ?? <span className="text-gray-600 font-normal text-xs">Not reached</span>}
                      </div>
                      {m.yearReached && m.person1Age && m.person2Age && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          Ages {m.person1Age} / {m.person2Age}
                        </div>
                      )}
                      <div className="text-xs text-gray-600 mt-1">{formatCompact(m.portfolioTarget)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Explanation note */}
            <div className="mt-6 p-4 bg-gray-900 border border-gray-800 rounded-xl text-xs text-gray-500 leading-relaxed">
              <strong className="text-gray-400">How surplus is calculated:</strong> Gross household income
              (salary + bonus) minus pre-tax 401(k) contributions, income tax ({(state.assumptions.incomeTaxRate * 100).toFixed(1)}%),
              FICA ({(state.assumptions.ficaRate * 100).toFixed(1)}%), annual expenses, and Roth IRA contributions.
              The {surplusPct}% invested fraction then flows to brokerage accounts. Remaining {100 - surplusPct}%
              is treated as spent (lifestyle spending, irregular expenses, etc.).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  sub?: string;
  color: string;
  onChange: (v: number) => void;
}

function SliderField({ label, value, min, max, step, format, sub, color, onChange }: SliderFieldProps) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-2">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{label}</label>
        <span className="text-lg font-bold tabular-nums" style={{ color }}>
          {format(value)}
        </span>
      </div>
      {sub && <div className="text-xs text-gray-600 mb-2">{sub}</div>}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${((value - min) / (max - min)) * 100}%, #374151 ${((value - min) / (max - min)) * 100}%, #374151 100%)`,
        }}
      />
      <div className="flex justify-between text-xs text-gray-700 mt-1">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}
