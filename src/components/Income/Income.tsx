import type { PersonInputs } from '../../engine/types';
import { PageHeader } from '../Layout/PageHeader';
import { Card } from '../Layout/Card';
import { FormField, Input } from '../Layout/FormField';

interface IncomeProps {
  person1: PersonInputs;
  person2: PersonInputs;
  projectionStartYear: number;
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

export function Income({ person1, person2, projectionStartYear, onUpdatePerson1, onUpdatePerson2 }: IncomeProps) {
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
            projectionStartYear={projectionStartYear}
            onChange={onUpdatePerson1}
            colorClass="text-indigo-400"
          />
          <PersonPanel
            label="Person 2"
            person={person2}
            projectionStartYear={projectionStartYear}
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
  projectionStartYear: number;
  onChange: (updates: Partial<PersonInputs>) => void;
  colorClass: string;
}

function PersonPanel({ label, person, projectionStartYear, onChange, colorClass }: PersonPanelProps) {
  return (
    <div className="space-y-5">
      <div className={`text-lg font-semibold ${colorClass}`}>{label}</div>

      <Card title="Employment & Demographics">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Current Age">
            <Input
              type="number"
              value={person.currentAge}
              min={18}
              max={80}
              onChange={(e) => onChange({ currentAge: num(e.target.value) })}
            />
          </FormField>
          <FormField label="Final Working Calendar Year" hint="Last year with full salary, bonus, and contributions.">
            <Input
              type="number"
              value={person.finalWorkingYear}
              min={projectionStartYear}
              max={projectionStartYear + 60}
              onChange={(e) => onChange({ finalWorkingYear: num(e.target.value) })}
            />
          </FormField>
        </div>
      </Card>

      <Card title="Salary & Bonus">
        <div className="space-y-4">
          <FormField label="Current Annual Base Salary">
            <Input
              type="number"
              prefix="$"
              value={person.baseSalary}
              onChange={(e) => onChange({ baseSalary: num(e.target.value) })}
            />
          </FormField>
          <FormField label="Annual Salary Growth Rate" hint="Projected average annual raise.">
            <Input
              type="number"
              suffix="%"
              value={(person.salaryGrowthRate * 100).toFixed(1)}
              step={0.1}
              onChange={(e) => onChange({ salaryGrowthRate: pct(e.target.value) })}
            />
          </FormField>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Min Bonus %" hint="Min scenario">
              <Input
                type="number"
                suffix="%"
                value={(person.minBonusPct * 100).toFixed(0)}
                onChange={(e) => onChange({ minBonusPct: pct(e.target.value) })}
              />
            </FormField>
            <FormField label="Target Bonus %" hint="Target scenario">
              <Input
                type="number"
                suffix="%"
                value={(person.targetBonusPct * 100).toFixed(0)}
                onChange={(e) => onChange({ targetBonusPct: pct(e.target.value) })}
              />
            </FormField>
            <FormField label="Max Bonus %" hint="Max scenario">
              <Input
                type="number"
                suffix="%"
                value={(person.maxBonusPct * 100).toFixed(0)}
                onChange={(e) => onChange({ maxBonusPct: pct(e.target.value) })}
              />
            </FormField>
          </div>
          <FormField label="Paychecks per Year">
            <Input
              type="number"
              value={person.paychecksPerYear}
              min={1}
              max={52}
              onChange={(e) => onChange({ paychecksPerYear: num(e.target.value) })}
            />
          </FormField>
        </div>
      </Card>

      <Card title="401(k) Contributions">
        <div className="space-y-4">
          <FormField label="Employee Contribution per Paycheck" hint="Applies each paycheck; total = amount × paychecks per year.">
            <Input
              type="number"
              prefix="$"
              value={person.contrib401kPerPaycheck}
              onChange={(e) => onChange({ contrib401kPerPaycheck: num(e.target.value) })}
            />
          </FormField>
          <FormField label="Employer Match Rate" hint="As a percentage of salary. Enter 0 if no match.">
            <Input
              type="number"
              suffix="%"
              value={(person.employerMatchRate * 100).toFixed(1)}
              step={0.1}
              onChange={(e) => onChange({ employerMatchRate: pct(e.target.value) })}
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
          <Input
            type="number"
            prefix="$"
            value={person.annualRothContrib}
            onChange={(e) => onChange({ annualRothContrib: num(e.target.value) })}
          />
        </FormField>
      </Card>

      <Card title="Starting Account Balances" subtitle="Replace with current statement balances. Placeholders are $0 unless noted.">
        <div className="space-y-4">
          <FormField label="Current 401(k) Balance">
            <Input
              type="number"
              prefix="$"
              value={person.starting401kBalance}
              onChange={(e) => onChange({ starting401kBalance: num(e.target.value) })}
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
            <Input
              type="number"
              prefix="$"
              value={person.startingRothBalance}
              onChange={(e) => onChange({ startingRothBalance: num(e.target.value) })}
            />
          </FormField>
          <FormField label="Current Taxable Brokerage Balance">
            <Input
              type="number"
              prefix="$"
              value={person.startingBrokerageBalance}
              onChange={(e) => onChange({ startingBrokerageBalance: num(e.target.value) })}
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
