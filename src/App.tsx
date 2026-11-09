import { useState } from 'react';
import { Layout } from './components/Layout/Layout';
import { Dashboard } from './components/Dashboard/Dashboard';
import { LivePlanner } from './components/Planner/LivePlanner';
import { Income } from './components/Income/Income';
import { Expenses } from './components/Expenses/Expenses';
import { FireGoals } from './components/FIRE/FireGoals';
import { Projections } from './components/Projections/Projections';
import { Settings } from './components/Settings/Settings';
import { useAppState } from './hooks/useAppState';

type Section = 'dashboard' | 'planner' | 'income' | 'expenses' | 'goals' | 'projections' | 'settings';

export default function App() {
  const [section, setSection] = useState<Section>('dashboard');
  const {
    state,
    updatePerson1,
    updatePerson2,
    updateExpenses,
    updateAssumptions,
    resetToDefaults,
    exportJSON,
    importJSON,
  } = useAppState();

  function renderSection() {
    switch (section) {
      case 'dashboard':
        return <Dashboard state={state} />;
      case 'planner':
        return <LivePlanner state={state} />;
      case 'income':
        return (
          <Income
            person1={state.person1}
            person2={state.person2}
            projectionStartYear={state.assumptions.projectionStartYear}
            onUpdatePerson1={updatePerson1}
            onUpdatePerson2={updatePerson2}
          />
        );
      case 'expenses':
        return (
          <Expenses
            expenses={state.expenses}
            spendingGrowthRate={state.assumptions.annualSpendingGrowth}
            onUpdateExpenses={updateExpenses}
            onUpdateSpendingGrowth={(rate) => updateAssumptions({ annualSpendingGrowth: rate })}
          />
        );
      case 'goals':
        return (
          <FireGoals
            state={state}
            onUpdatePerson1={updatePerson1}
            onUpdatePerson2={updatePerson2}
          />
        );
      case 'projections':
        return <Projections state={state} />;
      case 'settings':
        return <Settings assumptions={state.assumptions} onUpdate={updateAssumptions} />;
    }
  }

  return (
    <Layout
      activeSection={section}
      onNavigate={setSection}
      onExportJSON={exportJSON}
      onImportJSON={importJSON}
      onReset={() => {
        if (window.confirm('Reset all inputs to workbook defaults? This cannot be undone.')) {
          resetToDefaults();
        }
      }}
    >
      {renderSection()}
    </Layout>
  );
}
