import type { GlobalAssumptions } from '../../engine/types';
import { PageHeader } from '../Layout/PageHeader';
import { Card } from '../Layout/Card';
import { FormField, NumericInput, Select } from '../Layout/FormField';
import { Info } from 'lucide-react';

interface SettingsProps {
  assumptions: GlobalAssumptions;
  onUpdate: (updates: Partial<GlobalAssumptions>) => void;
}

export function Settings({ assumptions, onUpdate }: SettingsProps) {
  function pct(v: string): number {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n / 100;
  }

  function num(v: string): number {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }

  return (
    <div>
      <PageHeader
        title="Model Assumptions"
        description="All inputs here apply globally to the projection. All values can be edited; defaults are taken from the workbook."
      />
      <div className="p-8 space-y-6">
        <div className="flex items-start gap-3 bg-blue-950/30 border border-blue-800/40 rounded-xl p-4">
          <Info size={16} className="text-blue-400 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-200">
            Defaults are preserved from the Excel workbook. Fields marked with a note in the workbook are
            highlighted below. All are editable planning estimates — replace with values appropriate to your
            situation.
          </div>
        </div>

        <Card title="Investment & Economic Assumptions">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField
              label="Annual Investment Return"
              hint="Nominal annual return applied to all account types. Workbook default: 7%."
            >
              <NumericInput
                suffix="%"
                value={(assumptions.annualReturnRate * 100).toFixed(1)}
                onCommit={(v) => onUpdate({ annualReturnRate: pct(v) })}
              />
            </FormField>
            <FormField
              label="Annual Spending Growth"
              hint="Applied to household expenses each year. Workbook default: 3.5%."
            >
              <NumericInput
                suffix="%"
                value={(assumptions.annualSpendingGrowth * 100).toFixed(1)}
                onCommit={(v) => onUpdate({ annualSpendingGrowth: pct(v) })}
              />
            </FormField>
          </div>
        </Card>

        <Card title="Tax Assumptions" subtitle="Simplified planning estimates — not a tax calculation.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField
              label="Blended Income Tax Rate"
              hint="Estimated effective rate on ordinary income. Workbook default: 21.43%. Applied to income net of pre-tax 401(k) contributions."
            >
              <NumericInput
                suffix="%"
                value={(assumptions.incomeTaxRate * 100).toFixed(2)}
                onCommit={(v) => onUpdate({ incomeTaxRate: pct(v) })}
              />
            </FormField>
            <FormField
              label="FICA Tax Rate"
              hint="Applies to gross wages. Workbook default: 7.65% (employee share only). The FICA wage base limit is not modeled."
            >
              <NumericInput
                suffix="%"
                value={(assumptions.ficaRate * 100).toFixed(2)}
                onCommit={(v) => onUpdate({ ficaRate: pct(v) })}
              />
            </FormField>
          </div>
        </Card>

        <Card title="Surplus Allocation">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField
              label="Fraction of Surplus Invested"
              hint="Percentage of after-tax, after-expense cash flow invested in taxable brokerage accounts. Workbook default: 100%."
            >
              <NumericInput
                suffix="%"
                value={(assumptions.surplusInvestedFraction * 100).toFixed(0)}
                onCommit={(v) => onUpdate({ surplusInvestedFraction: pct(v) })}
              />
            </FormField>
            <FormField
              label="Person 1 Share of Investable Surplus"
              hint="Split of brokerage contributions between people. Workbook default: 50/50."
            >
              <NumericInput
                suffix="%"
                value={(assumptions.person1SurplusShare * 100).toFixed(0)}
                onCommit={(v) => onUpdate({ person1SurplusShare: pct(v) })}
              />
            </FormField>
            <FormField
              label="Person 1 Share of Household Expenses"
              hint="Used for staggered retirement cash flow modeling — determines how much of household expenses each person is responsible for after they stop working. Workbook default: 50%."
            >
              <NumericInput
                suffix="%"
                value={(assumptions.person1ExpenseShare * 100).toFixed(0)}
                onCommit={(v) => onUpdate({ person1ExpenseShare: pct(v) })}
              />
            </FormField>
          </div>
        </Card>

        <Card title="Projection Parameters">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <FormField label="Projection Start Year" hint="Calendar year corresponding to year 0 of the projection.">
              <NumericInput
                value={assumptions.projectionStartYear}
                inputMode="numeric"
                onCommit={(v) => onUpdate({ projectionStartYear: num(v) })}
              />
            </FormField>
            <FormField label="Projection Length (Years)" hint="Workbook default: 40 years.">
              <NumericInput
                value={assumptions.projectionLength}
                inputMode="numeric"
                onCommit={(v) => onUpdate({ projectionLength: num(v) })}
              />
            </FormField>
            <FormField label="Default Bonus Scenario" hint="Used in Dashboard; Projections view shows all three.">
              <Select
                value={assumptions.bonusScenario}
                options={[
                  { value: 'minimum', label: 'Minimum' },
                  { value: 'target', label: 'Target' },
                  { value: 'maximum', label: 'Maximum' },
                ]}
                onChange={(e) =>
                  onUpdate({ bonusScenario: e.target.value as GlobalAssumptions['bonusScenario'] })
                }
              />
            </FormField>
          </div>
        </Card>

        <Card title="Modeling Limitations">
          <div className="space-y-3 text-sm text-gray-400 leading-relaxed">
            <p>
              <strong className="text-gray-300">Tax simplification:</strong> The model applies a single blended
              income tax rate and FICA rate to all employment income. It does not model marginal tax brackets,
              state income taxes, the FICA wage base cap, or payroll deduction ordering. The estimate is a
              reasonable planning approximation, not a payroll tax calculation.
            </p>
            <p>
              <strong className="text-gray-300">Roth IRA eligibility:</strong> Roth IRA contributions are
              subject to income phase-out limits. At high income levels, contributions may require backdoor Roth
              conversions. The model does not validate IRS eligibility rules.
            </p>
            <p>
              <strong className="text-gray-300">401(k) contribution limits:</strong> IRS annual 401(k) limits
              are not enforced. Enter amounts within current IRS limits (and catch-up provisions for age 50+).
            </p>
            <p>
              <strong className="text-gray-300">Investment returns:</strong> A single constant real return is
              applied uniformly across all account types (401k, Roth, brokerage). Actual returns will vary by
              asset allocation, sequence of returns, and market conditions.
            </p>
            <p>
              <strong className="text-gray-300">Withdrawal taxation:</strong> Post-retirement withdrawals are
              modeled as portfolio outflows but do not account for the tax character of distributions
              (traditional 401k / IRA distributions are taxable as ordinary income).
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
