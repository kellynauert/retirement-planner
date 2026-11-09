import React from 'react';
import { BarChart2, Home, DollarSign, ShoppingCart, TrendingUp, Settings, Download, Upload, RotateCcw, Sliders } from 'lucide-react';

type Section = 'dashboard' | 'planner' | 'income' | 'expenses' | 'projections' | 'settings';

interface LayoutProps {
  children: React.ReactNode;
  activeSection: Section;
  onNavigate: (section: Section) => void;
  onExportJSON: () => void;
  onImportJSON: (file: File) => void;
  onReset: () => void;
}

const NAV_ITEMS: { id: Section; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; badge?: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'planner', label: 'Live Planner', icon: Sliders, badge: 'Interactive' },
  { id: 'income', label: 'Household Income', icon: DollarSign },
  { id: 'expenses', label: 'Expenses', icon: ShoppingCart },
  { id: 'projections', label: 'Projections', icon: TrendingUp },
  { id: 'settings', label: 'Assumptions', icon: Settings },
];

export function Layout({ children, activeSection, onNavigate, onExportJSON, onImportJSON, onReset }: LayoutProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
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

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV_ITEMS.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
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
        <div className="p-3 border-t border-gray-800 space-y-1">
          <button
            onClick={onExportJSON}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <Download size={14} />
            Export JSON
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <Upload size={14} />
            Import JSON
          </button>
          <button
            onClick={onReset}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-amber-400 hover:bg-gray-800 transition-colors"
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
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
