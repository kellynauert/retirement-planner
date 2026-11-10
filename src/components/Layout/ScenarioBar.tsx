import { useEffect, useState } from 'react';
import type { SaveStatus } from '../../hooks/useAppState';

interface ScenarioBarProps {
  scenarios: { id: string; name: string }[];
  activeId: string;
  activeName: string;
  saveStatus: SaveStatus;
  onSelect: (id: string) => void;
  onRename: (name: string) => void;
  onSaveAs: (name: string) => void;
  onDelete: () => void;
  onRetry: () => void;
}

const STATUS: Record<SaveStatus, string> = {
  loading: 'Loading your plans…',
  saving: 'Saving to your account…',
  saved: 'Saved to your account',
  error: 'Couldn’t save to your account',
  'local-only': 'Only in this browser — not on your account',
};

export function ScenarioBar({
  scenarios,
  activeId,
  activeName,
  saveStatus,
  onSelect,
  onRename,
  onSaveAs,
  onDelete,
  onRetry,
}: ScenarioBarProps) {
  const [name, setName] = useState(activeName);
  const [draft, setDraft] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setName(activeName);
  }, [activeName, activeId]);

  const statusColor =
    saveStatus === 'saved'
      ? 'text-emerald-400'
      : saveStatus === 'error' || saveStatus === 'local-only'
        ? 'text-amber-400'
        : 'text-gray-500';

  return (
    <div className="px-3 py-3 border-b border-gray-800 space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Scenario</label>
        <span className={`text-[10px] ${statusColor}`}>{STATUS[saveStatus]}</span>
      </div>
      <select
        value={activeId}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white outline-none"
      >
        {scenarios.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          if (name.trim() && name.trim() !== activeName) onRename(name);
          else setName(activeName);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        aria-label="Scenario name"
        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-indigo-500"
      />
      {creating ? (
        <div className="flex gap-1">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draft.trim()) {
                onSaveAs(draft);
                setDraft('');
                setCreating(false);
              }
            }}
            placeholder="New scenario name"
            className="flex-1 min-w-0 bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white outline-none"
          />
          <button
            onClick={() => {
              if (draft.trim()) onSaveAs(draft);
              setDraft('');
              setCreating(false);
            }}
            className="px-2 py-1.5 rounded-lg bg-indigo-600 text-white text-xs"
          >
            Save
          </button>
        </div>
      ) : (
        <div className="flex gap-1">
          <button
            onClick={() => setCreating(true)}
            className="flex-1 px-2 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs"
          >
            Save as new
          </button>
          <button
            onClick={onDelete}
            disabled={scenarios.length <= 1}
            className="px-2 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      )}
      {saveStatus === 'error' && (
        <button onClick={onRetry} className="text-[11px] text-amber-300 underline">
          Retry save
        </button>
      )}
    </div>
  );
}
