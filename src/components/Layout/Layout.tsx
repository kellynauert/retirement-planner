import React from 'react';
import { BarChart2, Home, DollarSign, ShoppingCart, TrendingUp, Settings, Download, Upload, RotateCcw, Sliders } from 'lucide-react';
import { ScenarioBar } from './ScenarioBar';
import type { SaveStatus } from '../../hooks/useAppState';

type Section = 'dashboard' | 'planner' | 'income' | 'expenses' | 'projections' | 'settings';

interface LayoutProps {
  children: React.ReactNode;
  activeSection: Section;
  onNavigate: (section: Section) => void;
  onExportJSON: () => void;
  onImportJSON: (file: File) => void;
  onReset: () => void;
  scenarios: { id: string; name: string }[];
  activeScenarioId: string;
  activeScenarioName: string;
  saveStatus: SaveStatus;
  onSelectScenario: (id: string) => void;
  onRenameScenario: (name: string) => void;
  onSaveScenarioAs: (name: string) => void;
  onDeleteScenario: () => void;
  onRetrySave: () => void;
}

const NAV_ITEMS: { id: Section; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; badge?: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'planner', label: 'Live Planner', icon: Sliders, badge: 'Interactive' },
  { id: 'income', label: 'Household Income', icon: DollarSign },
  { id: 'expenses', label: 'Expenses', icon: ShoppingCart },
  { id: 'projections', label: 'Projections', icon: TrendingUp },
  { id: 'settings', label: 'Assumptions', icon: Settings },
];

export function Layout({
  children,
  activeSection,
  onNavigate,
  onExportJSON,
  onImportJSON,
  onReset,
  scenarios,
  activeScenarioId,
  activeScenarioName,
  saveStatus,
  onSelectScenario,
  onRenameScenario,
  onSaveScenarioAs,
  onDeleteScenario,
  onRetrySave,
}: LayoutProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="w-full lg:w-60 lg:shrink-0 bg-gray-900 border-b lg:border-b-0 lg:border-r border-gray-800 flex flex-col">
        {/* Logo */}
        <div className="p-5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <BarChart2 size={22} className="text-indigo-400" />
            <div>
              <div className="text-white font-semibold text-sm leading-tight">Retirement Planner</div>
              <div className="text-gray-500 text-xs">Household financial model</div>
            </div>
          </div>
        </div>

        <ScenarioBar
          scenarios={scenarios}
          activeId={activeScenarioId}
          activeName={activeScenarioName}
          saveStatus={saveStatus}
          onSelect={onSelectScenario}
          onRename={onRenameScenario}
          onSaveAs={onSaveScenarioAs}
          onDelete={onDeleteScenario}
          onRetry={onRetrySave}
        />

        {/* Nav */}
        <nav className="flex lg:flex-col gap-1 overflow-x-auto p-3">
          {NAV_ITEMS.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`shrink-0 lg:w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                activeSection === id
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Icon size={16} />
              <span className="flex-1 text-left">{label}</span>
              {badge && (
                <span className="text-[9px] font-semibold uppercase tracking-wide bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Footer actions */}
        <div className="p-3 border-t border-gray-800 flex lg:flex-col gap-1 overflow-x-auto">
          <button
            onClick={onExportJSON}
            className="shrink-0 lg:w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors whitespace-nowrap"
          >
            <Download size={14} />
            Export scenarios
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 lg:w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors whitespace-nowrap"
          >
            <Upload size={14} />
            Import JSON
          </button>
          <button
            onClick={onReset}
            className="shrink-0 lg:w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-amber-400 hover:bg-gray-800 transition-colors whitespace-nowrap"
          >
            <RotateCcw size={14} />
            Reset to Defaults
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImportJSON(file);
              e.target.value = '';
            }}
          />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  );
}
