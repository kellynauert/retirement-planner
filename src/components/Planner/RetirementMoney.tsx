import type { AppState, ProjectionRow } from '../../engine/types';
import { retirementOutlook } from '../../engine/calculator';
import { formatCurrency } from '../../engine/formatters';

export function RetirementMoney({ state, rows }: { state: AppState; rows: ProjectionRow[] }) {
  const outlook = retirementOutlook(rows, state);
  const money = (value: number | null) => (value == null ? '—' : formatCurrency(value));

  return (
    <div className="px-4 sm:px-6 py-5 border-b border-gray-800 min-w-0">
      <div className="text-sm font-medium text-white">Money through age {outlook.planningAge}</div>
      <div className="text-xs text-gray-500 mt-0.5 mb-4">
        Combined portfolio from the last working year through each death. Spending stays at the full household
        amount after the first death, and that portfolio passes to the survivor.
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-0">
        <Balance
          label="At retirement"
          value={money(outlook.nestEgg)}
          sub={
            outlook.lastWorkingYear
              ? `End of ${outlook.lastWorkingYear}, ages ${outlook.nestEggPerson1Age} and ${outlook.nestEggPerson2Age}`
              : 'Last working year is outside this plan'
          }
        />
        <Balance
          label={`Person 1 at ${outlook.planningAge}`}
          value={money(outlook.atPerson1Death)}
          sub={String(outlook.person1DeathYear)}
        />
        <Balance
          label={`Person 2 at ${outlook.planningAge}`}
          value={money(outlook.atPerson2Death)}
          sub={String(outlook.person2DeathYear)}
        />
      </div>
      {outlook.ranOutYear ? (
        <div className="mt-3 text-sm text-red-300">
          The combined portfolio is drawn down to $0 in {outlook.ranOutYear}.
        </div>
      ) : outlook.lowestBalance != null && outlook.lowestBalanceYear ? (
        <div className="mt-3 text-xs text-gray-500">
          Lowest combined balance during retirement is {formatCurrency(outlook.lowestBalance)} in{' '}
          {outlook.lowestBalanceYear}.
        </div>
      ) : null}
    </div>
  );
}

function Balance({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-gray-900 border border-gray-800 p-4">
      <div className="text-xs text-gray-500 uppercase tracking-widest mb-2">{label}</div>
      <div className="font-bold text-white tabular-nums leading-none break-words" style={{ fontSize: 'clamp(1.25rem, 2.4vw, 1.75rem)' }}>
        {value}
      </div>
      <div className="mt-2 text-xs text-gray-500">{sub}</div>
    </div>
  );
}
