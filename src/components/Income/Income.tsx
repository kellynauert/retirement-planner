import type { PersonInputs } from '../../engine/types';
import { PageHeader } from '../Layout/PageHeader';
import { Card } from '../Layout/Card';
import { FormField, NumericInput } from '../Layout/FormField';

interface IncomeProps {
  person1: PersonInputs;
  person2: PersonInputs;
  onUpdatePerson1: (updates: Partial<PersonInputs>) => void;
  onUpdatePerson2: (updates: Partial<PersonInputs>) => void;
}

function num(v: string): number {
  const n = parseFloat(v.replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function pct(v: string): number {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n / 100;
}

export function Income({ person1, person2, onUpdatePerson1, onUpdatePerson2 }: IncomeProps) {
  return (
    <div>
      <PageHeader
        title="Household Income"
        description="Configure each person's salary, bonus, retirement contributions, and starting account balances. Yellow fields in the original workbook correspond to the editable fields here."
      />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <PersonPanel
            label="Person 1"
            person={person1}
            onChange={onUpdatePerson1}
            colorClass="text-indigo-400"
          />
          <PersonPanel
            label="Person 2"
            person={person2}
            onChange={onUpdatePerson2}
            colorClass="text-emerald-400"
          />
        </div>
      </div>
    </div>
  );
}

interface PersonPanelProps {
  label: string;
  person: PersonInputs;
  onChange: (updates: Partial<PersonInputs>) => void;
  colorClass: string;
}

function PersonPanel({ label, person, onChange, colorClass }: PersonPanelProps) {
  return (
    <div className="space-y-5">
      <div className={`text-lg font-semibold ${colorClass}`}>{label}</div>

      <Card title="Employment & Demographics">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Current Age">
            <NumericInput
              value={person.currentAge}
              inputMode="numeric"
              onCommit={(v) => onChange({ currentAge: num(v) })}
            />
          </FormField>
          <FormField label="Final Working Calendar Year" hint="Last year with full salary, bonus, and contributions.">
            <NumericInput
              value={person.finalWorkingYear}
              inputMode="numeric"
              onCommit={(v) => onChange({ finalWorkingYear: num(v) })}
            />
          </FormField>
        </div>
      </Card>

      <Card title="Salary & Bonus">
        <div className="space-y-4">
          <FormField label="Current Annual Base Salary">
            <NumericInput
              prefix="$"
              value={person.baseSalary}
              onCommit={(v) => onChange({ baseSalary: num(v) })}
            />
          </FormField>
          <FormField label="Annual Salary Growth Rate" hint="Projected average annual raise.">
            <NumericInput
              suffix="%"
              value={(person.salaryGrowthRate * 100).toFixed(1)}
              onCommit={(v) => onChange({ salaryGrowthRate: pct(v) })}
            />
          </FormField>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Min Bonus %" hint="Min scenario">
              <NumericInput
                suffix="%"
                value={(person.minBonusPct * 100).toFixed(0)}
                onCommit={(v) => onChange({ minBonusPct: pct(v) })}
              />
            </FormField>
            <FormField label="Target Bonus %" hint="Target scenario">
              <NumericInput
                suffix="%"
                value={(person.targetBonusPct * 100).toFixed(0)}
                onCommit={(v) => onChange({ targetBonusPct: pct(v) })}
              />
            </FormField>
            <FormField label="Max Bonus %" hint="Max scenario">
              <NumericInput
                suffix="%"
                value={(person.maxBonusPct * 100).toFixed(0)}
                onCommit={(v) => onChange({ maxBonusPct: pct(v) })}
              />
            </FormField>
          </div>
          <FormField label="Paychecks per Year">
            <NumericInput
              value={person.paychecksPerYear}
              inputMode="numeric"
              onCommit={(v) => onChange({ paychecksPerYear: num(v) })}
            />
          </FormField>
        </div>
      </Card>

      <Card title="401(k) Contributions">
        <div className="space-y-4">
          <FormField label="Employee Contribution per Paycheck" hint="Applies each paycheck; total = amount × paychecks per year.">
            <NumericInput
              prefix="$"
              value={person.contrib401kPerPaycheck}
              onCommit={(v) => onChange({ contrib401kPerPaycheck: num(v) })}
            />
          </FormField>
          <FormField label="Employer Match Rate" hint="As a percentage of salary. Enter 0 if no match.">
            <NumericInput
              suffix="%"
              value={(person.employerMatchRate * 100).toFixed(1)}
              onCommit={(v) => onChange({ employerMatchRate: pct(v) })}
            />
          </FormField>
          <div className="text-xs text-gray-500">
            Annual 401(k) contribution:{' '}
            <span className="text-white">
              ${(person.contrib401kPerPaycheck * person.paychecksPerYear).toLocaleString()}
            </span>{' '}
            · Employer match:{' '}
            <span className="text-white">
              ${Math.round(person.baseSalary * person.employerMatchRate).toLocaleString()} / year (approximate)
            </span>
          </div>
        </div>
      </Card>

      <Card title="Roth IRA">
        <FormField label="Annual Roth IRA Contribution" hint="Subject to IRS eligibility and income limits. Verify annually.">
          <NumericInput
            prefix="$"
            value={person.annualRothContrib}
            onCommit={(v) => onChange({ annualRothContrib: num(v) })}
          />
        </FormField>
      </Card>

      <Card title="Starting Account Balances" subtitle="Replace with current statement balances. Placeholders are $0 unless noted.">
        <div className="space-y-4">
          <FormField label="Current 401(k) Balance">
            <NumericInput
              prefix="$"
              value={person.starting401kBalance}
              onCommit={(v) => onChange({ starting401kBalance: num(v) })}
            />
          </FormField>
          <FormField
            label="Current Roth IRA Balance"
            hint={
              label === 'Person 1'
                ? 'Workbook note: $30,000 is a previously reported approximate figure — verify with current statement.'
                : undefined
            }
          >
            <NumericInput
              prefix="$"
              value={person.startingRothBalance}
              onCommit={(v) => onChange({ startingRothBalance: num(v) })}
            />
          </FormField>
          <FormField label="Current Taxable Brokerage Balance">
            <NumericInput
              prefix="$"
              value={person.startingBrokerageBalance}
              onCommit={(v) => onChange({ startingBrokerageBalance: num(v) })}
            />
          </FormField>
          <div className="text-xs text-gray-500">
            Total starting portfolio:{' '}
            <span className="text-white font-medium">
              $
              {(
                person.starting401kBalance +
                person.startingRothBalance +
                person.startingBrokerageBalance
              ).toLocaleString()}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
