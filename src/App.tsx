import { useState } from 'react';
import { Layout } from './components/Layout/Layout';
import { Dashboard } from './components/Dashboard/Dashboard';
import { LivePlanner } from './components/Planner/LivePlanner';
import { Income } from './components/Income/Income';
import { Expenses } from './components/Expenses/Expenses';
import { Projections } from './components/Projections/Projections';
import { Settings } from './components/Settings/Settings';
import { useAppState } from './hooks/useAppState';
import { horizonYears } from './engine/calculator';

type Section = 'dashboard' | 'planner' | 'income' | 'expenses' | 'projections' | 'settings';

export default function App() {
  const [section, setSection] = useState<Section>('dashboard');
  const {
    ready,
    state,
    saveStatus,
    scenarios,
    activeScenarioId,
    activeScenarioName,
    updatePerson1,
    updatePerson2,
    updateExpenses,
    updateMortgage,
    updateFutureMortgage,
    updateAssumptions,
    resetToDefaults,
    selectScenario,
    renameScenario,
    saveScenarioAs,
    deleteScenario,
    retrySave,
    exportJSON,
    importJSON,
  } = useAppState();

  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-400 flex items-center justify-center">
        Loading your saved plans…
      </div>
    );
  }

  function renderSection() {
    switch (section) {
      case 'dashboard':
        return <Dashboard state={state} />;
      case 'planner':
        return (
          <LivePlanner
            state={state}
            onUpdatePerson1={updatePerson1}
            onUpdatePerson2={updatePerson2}
            onUpdateAssumptions={updateAssumptions}
            onUpdateMortgage={updateMortgage}
            onUpdateFutureMortgage={updateFutureMortgage}
          />
        );
      case 'income':
        return (
          <Income
            person1={state.person1}
            person2={state.person2}
            onUpdatePerson1={updatePerson1}
            onUpdatePerson2={updatePerson2}
          />
        );
      case 'expenses':
        return (
          <Expenses
            expenses={state.expenses}
            mortgage={state.mortgage}
            futureMortgage={state.futureMortgage}
            projectionStartYear={state.assumptions.projectionStartYear}
            projectionLength={horizonYears(state)}
            spendingGrowthRate={state.assumptions.annualSpendingGrowth}
            onUpdateExpenses={updateExpenses}
            onUpdateSpendingGrowth={(rate) => updateAssumptions({ annualSpendingGrowth: rate })}
            onUpdateMortgage={updateMortgage}
            onUpdateFutureMortgage={updateFutureMortgage}
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
        if (window.confirm('Reset this scenario to workbook defaults? This cannot be undone.')) {
          resetToDefaults();
        }
      }}
      scenarios={scenarios}
      activeScenarioId={activeScenarioId}
      activeScenarioName={activeScenarioName}
      saveStatus={saveStatus}
      onSelectScenario={selectScenario}
      onRenameScenario={renameScenario}
      onSaveScenarioAs={saveScenarioAs}
      onDeleteScenario={() => {
        if (window.confirm('Delete this scenario? The others stay saved.')) deleteScenario();
      }}
      onRetrySave={retrySave}
    >
      {renderSection()}
    </Layout>
  );
}
