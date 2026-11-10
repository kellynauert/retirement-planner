import { useMemo } from 'react';
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
import type { AppState, FutureMortgageInputs, MortgageInputs } from '../../engine/types';
import {
  runProjection,
  computeHouseholdFireMilestones,
} from '../../engine/calculator';
import { simulateMortgage } from '../../engine/mortgage';
import { formatCurrency, formatCompact } from '../../engine/formatters';
import { PageHeader } from '../Layout/PageHeader';
import { NumericInput } from '../Layout/FormField';

interface LivePlannerProps {
  state: AppState;
  onUpdatePerson1: (updates: Partial<AppState['person1']>) => void;
  onUpdatePerson2: (updates: Partial<AppState['person2']>) => void;
  onUpdateAssumptions: (updates: Partial<AppState['assumptions']>) => void;
  onUpdateMortgage: (updates: Partial<MortgageInputs>) => void;
  onUpdateFutureMortgage: (updates: Partial<FutureMortgageInputs>) => void;
}

const FIRE_COLORS: Record<string, string> = {
  lean: '#94a3b8',
  traditional: '#10b981',
  conservative: '#06b6d4',
  fat: '#f59e0b',
  very_conservative: '#ef4444',
};

export function LivePlanner({
  state,
  onUpdatePerson1,
  onUpdatePerson2,
  onUpdateAssumptions,
  onUpdateMortgage,
  onUpdateFutureMortgage,
}: LivePlannerProps) {
  const p1FinalYear = state.person1.finalWorkingYear;
  const p2FinalYear = state.person2.finalWorkingYear;
  const surplusPct = Math.round(state.assumptions.surplusInvestedFraction * 100);
  const scenario = state.assumptions.bonusScenario;

  const startYear = state.assumptions.projectionStartYear;
  const endYear = startYear + state.assumptions.projectionLength;

  const rows = useMemo(() => runProjection(state), [state]);
  const mortgageSim = useMemo(
    () =>
      simulateMortgage({
        projectionStartYear: state.assumptions.projectionStartYear,
        yearCount: state.assumptions.projectionLength + 1,
        mortgage: state.mortgage,
        future: state.futureMortgage,
        flatMonthlyPayment: state.expenses.categories.find((c) => c.id === 'mortgage')?.monthlyAmount ?? 0,
        spendingGrowthRate: state.assumptions.annualSpendingGrowth,
      }),
    [state],
  );

  const baseAnnual = rows[0]?.householdAnnualExpenses ?? 0;

  const fireMilestones = useMemo(
    () => computeHouseholdFireMilestones(rows, baseAnnual),
    [rows, baseAnnual],
  );

  // Current year 1 cash flow (first full year of contributions)
  const surplusRow = rows[1] ?? rows[0];
  const annualTotal = surplusRow.annualDiscretionarySurplus;
  const annualInvestable = surplusRow.annualSurplusBeforeInvest;
  const annualSpendable = annualTotal - annualInvestable;

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
        description="Adjust the plan and it saves into the scenario selected in the sidebar. Use Save as new before you experiment if you want to keep the current version."
      />

      <div className="flex flex-col xl:flex-row xl:h-[calc(100vh-89px)] min-w-0">
        {/* ── Left panel: controls ── */}
        <div className="w-full xl:w-72 xl:shrink-0 border-b xl:border-b-0 xl:border-r border-gray-800 bg-gray-900 overflow-y-auto p-6 space-y-7">

          {/* Scenario */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Bonus Scenario
            </label>
            <div className="grid grid-cols-3 gap-1">
              {(['minimum', 'target', 'maximum'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => onUpdateAssumptions({ bonusScenario: s })}
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
            onChange={(year) => onUpdatePerson1({ finalWorkingYear: year })}
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
            onChange={(year) => onUpdatePerson2({ finalWorkingYear: year })}
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
            onChange={(pct) => onUpdateAssumptions({ surplusInvestedFraction: pct / 100 })}
          />

          <div className="space-y-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Mortgage</div>
            <SliderField
              label="Extra principal / month"
              value={state.mortgage.extraMonthlyPayment}
              min={0}
              max={Math.max(3000, state.mortgage.extraMonthlyPayment)}
              step={50}
              format={(v) => formatCurrency(v)}
              sub={state.mortgage.currentBalance > 0 ? `${formatCurrency(mortgageSim.contractualPayment + state.mortgage.extraMonthlyPayment)} / mo total` : 'Set a balance to calculate payoff'}
              color="#f43f5e"
              onChange={(amount) => onUpdateMortgage({ extraMonthlyPayment: amount })}
            />
            <label className="block text-xs text-gray-500">Remaining balance</label>
            <NumericInput
              prefix="$"
              value={state.mortgage.currentBalance || ''}
              placeholder="0"
              onCommit={(v) => onUpdateMortgage({ currentBalance: Math.max(0, parseFloat(v.replace(/,/g, '')) || 0) })}
            />
            <button
              type="button"
              onClick={() => onUpdateFutureMortgage({ enabled: !state.futureMortgage.enabled })}
              className={`w-full py-2 rounded-lg text-xs font-medium ${state.futureMortgage.enabled ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300'}`}
            >
              Next mortgage {state.futureMortgage.enabled ? 'on' : 'off'}
            </button>
            {state.futureMortgage.enabled && (
              <>
                <SliderField
                  label="Next mortgage starts"
                  value={state.futureMortgage.startYear}
                  min={startYear}
                  max={endYear}
                  step={1}
                  format={(v) => v.toString()}
                  sub="Paid-down principal reduces the new loan"
                  color="#a78bfa"
                  onChange={(year) => onUpdateFutureMortgage({ startYear: year })}
                />
                <label className="block text-xs text-gray-500">Purchase price</label>
                <NumericInput
                  prefix="$"
                  value={state.futureMortgage.purchasePrice || ''}
                  placeholder="0"
                  onCommit={(v) => onUpdateFutureMortgage({ purchasePrice: Math.max(0, parseFloat(v.replace(/,/g, '')) || 0) })}
                />
              </>
            )}
          </div>

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
        <div className="flex-1 min-w-0 overflow-y-auto">

          {/* Cash flow breakdown: spendable vs investable */}
          <div className="grid grid-cols-1 md:grid-cols-2 border-b border-gray-800 min-w-0">
            <MoneyPanel
              label={`Invested (${surplusPct}%)`}
              hint="Flows to brokerage accounts"
              dotClass="bg-emerald-400"
              annual={Math.max(0, annualInvestable)}
              monthly={Math.max(0, annualInvestable / 12)}
              valueClass={annualInvestable > 0 ? 'text-emerald-400' : 'text-red-400'}
              className="border-b md:border-b-0 md:border-r border-gray-800"
            />
            <MoneyPanel
              label={`Spendable (${100 - surplusPct}%)`}
              hint="Lifestyle, irregular expenses, etc."
              dotClass="bg-sky-400"
              annual={Math.max(0, annualSpendable)}
              monthly={Math.max(0, annualSpendable / 12)}
              valueClass={annualSpendable > 0 ? 'text-sky-400' : 'text-gray-500'}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 border-b border-gray-800 min-w-0">
            <div className="min-w-0 overflow-hidden p-4 sm:p-6 border-b md:border-b-0 md:border-r border-gray-800">
              <div className="text-xs text-gray-500 uppercase tracking-widest mb-2">Mortgage payoff</div>
              <div className="font-bold text-rose-300 leading-none break-words" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)' }}>
                {state.mortgage.currentBalance <= 0
                  ? 'Add a balance'
                  : mortgageSim.rolledOver
                    ? `Rolls in ${state.futureMortgage.startYear}`
                    : (mortgageSim.currentPayoffYear ?? 'Beyond plan')}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                {state.mortgage.currentBalance > 0
                  ? `${formatCurrency(mortgageSim.contractualPayment + state.mortgage.extraMonthlyPayment)} / month, then the payment drops out of expenses.`
                  : 'The Mortgage / Rent line stays a flat bill until you enter what you owe.'}
              </div>
            </div>
            <div className="min-w-0 overflow-hidden p-4 sm:p-6">
              <div className="text-xs text-gray-500 uppercase tracking-widest mb-2">Next mortgage</div>
              <div className="font-bold text-violet-300 leading-none break-words" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)' }}>
                {!state.futureMortgage.enabled
                  ? 'Off'
                  : state.futureMortgage.purchasePrice <= 0
                    ? 'Set a price'
                    : mortgageSim.futureStartingBalance <= 0
                      ? 'Paid off'
                      : (mortgageSim.futurePayoffYear ?? 'Beyond plan')}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                {state.futureMortgage.enabled && state.futureMortgage.purchasePrice > 0
                  ? `${formatCurrency(mortgageSim.equityApplied)} of principal paid down comes off a ${formatCurrency(state.futureMortgage.purchasePrice)} purchase. New loan ${formatCurrency(mortgageSim.futureStartingBalance)}.`
                  : 'Turn it on and set a purchase price. Principal you have paid down reduces the new loan.'}
              </div>
            </div>
          </div>

          {/* Deficit warning */}
          {annualTotal <= 0 && (
            <div className="mx-6 mt-4 px-4 py-3 bg-red-950/40 border border-red-800/40 rounded-lg text-sm text-red-400">
              Expenses and contributions exceed after-tax income in year 1 — no investable or spendable surplus.
            </div>
          )}

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
                  {mortgageSim.currentPayoffYear && (
                    <ReferenceLine x={mortgageSim.currentPayoffYear} stroke="#fb7185" strokeDasharray="3 3" strokeOpacity={0.8}>
                      <Label value="Mortgage paid off" position="insideTopLeft" style={{ fill: '#fb7185', fontSize: 10 }} />
                    </ReferenceLine>
                  )}
                  {state.futureMortgage.enabled && mortgageSim.futurePayoffYear && (
                    <ReferenceLine x={mortgageSim.futurePayoffYear} stroke="#a78bfa" strokeDasharray="3 3" strokeOpacity={0.8}>
                      <Label value="New mortgage paid off" position="insideTopLeft" style={{ fill: '#a78bfa', fontSize: 10 }} />
                    </ReferenceLine>
                  )}

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
              <strong className="text-gray-400">How these numbers are calculated:</strong> Gross household income
              (salary + bonus) minus pre-tax 401(k) contributions, income tax ({(state.assumptions.incomeTaxRate * 100).toFixed(1)}%),
              FICA ({(state.assumptions.ficaRate * 100).toFixed(1)}%), annual expenses, and Roth IRA contributions.
              The resulting discretionary surplus is split: {surplusPct}% goes to brokerage (investable) and {100 - surplusPct}% is available to spend freely. All figures are year 1 ({startYear + 1}) estimates.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MoneyPanel({
  label,
  hint,
  dotClass,
  annual,
  monthly,
  valueClass,
  className = '',
}: {
  label: string;
  hint: string;
  dotClass: string;
  annual: number;
  monthly: number;
  valueClass: string;
  className?: string;
}) {
  return (
    <div className={`min-w-0 overflow-hidden p-4 sm:p-6 ${className}`}>
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest truncate">{label}</span>
      </div>
      <div className="text-xs text-gray-600 mb-4">{hint}</div>
      <div className="space-y-4">
        <Amount label="Annual" value={annual} valueClass={valueClass} />
        <Amount label="Monthly" value={monthly} valueClass={valueClass} />
      </div>
    </div>
  );
}

function Amount({ label, value, valueClass }: { label: string; value: number; valueClass: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">{label}</div>
      <div className={`font-bold tabular-nums leading-none break-words ${valueClass}`} style={{ fontSize: 'clamp(1.35rem, 2.6vw, 2.25rem)' }}>
        {formatCurrency(value)}
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
