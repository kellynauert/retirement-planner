import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppState } from '../engine/types';
import { DEFAULT_STATE } from '../engine/defaults';

const LEGACY_KEY = 'retirement-planner-v1';
const LOCAL_KEY = 'retirement-planner-scenarios-v1';
const API = '/api/scenarios';

export type SaveStatus = 'loading' | 'saving' | 'saved' | 'error' | 'local-only';

export interface SavedScenario {
  id: string;
  name: string;
  updatedAt: number;
  state: AppState;
}

export interface ScenarioStore {
  activeId: string;
  scenarios: SavedScenario[];
}

function mergeState(parsed: Partial<AppState> | undefined): AppState {
  return {
    person1: { ...DEFAULT_STATE.person1, ...parsed?.person1 },
    person2: { ...DEFAULT_STATE.person2, ...parsed?.person2 },
    expenses: parsed?.expenses ?? DEFAULT_STATE.expenses,
    mortgage: { ...DEFAULT_STATE.mortgage, ...parsed?.mortgage },
    futureMortgage: { ...DEFAULT_STATE.futureMortgage, ...parsed?.futureMortgage },
    assumptions: { ...DEFAULT_STATE.assumptions, ...parsed?.assumptions },
  };
}

function newId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

function freshStore(state: AppState = DEFAULT_STATE, name = 'My plan'): ScenarioStore {
  const id = newId();
  return { activeId: id, scenarios: [{ id, name, updatedAt: Date.now(), state }] };
}

function normalizeStore(raw: unknown): ScenarioStore | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as { activeId?: unknown; scenarios?: unknown };
  if (!Array.isArray(body.scenarios)) return null;
  const scenarios: SavedScenario[] = [];
  for (const item of body.scenarios) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Partial<SavedScenario>;
    if (typeof row.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(row.id)) continue;
    const name = typeof row.name === 'string' ? row.name.trim().slice(0, 80) : '';
    if (!name || !row.state || typeof row.state !== 'object') continue;
    scenarios.push({
      id: row.id,
      name,
      updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : Date.now(),
      state: mergeState(row.state as Partial<AppState>),
    });
  }
  if (scenarios.length === 0) return null;
  const activeId = scenarios.some((s) => s.id === body.activeId) ? (body.activeId as string) : scenarios[0].id;
  return { activeId, scenarios };
}

function readLocal(): ScenarioStore {
  try {
    const saved = normalizeStore(JSON.parse(localStorage.getItem(LOCAL_KEY) ?? 'null'));
    if (saved) return saved;
  } catch {
    // Ignore a corrupt local copy and fall through.
  }
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) return freshStore(mergeState(JSON.parse(legacy) as Partial<AppState>));
  } catch {
    // Ignore a corrupt legacy copy.
  }
  return freshStore();
}

function writeLocal(store: ScenarioStore): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(store));
    const active = store.scenarios.find((s) => s.id === store.activeId) ?? store.scenarios[0];
    localStorage.setItem(LEGACY_KEY, JSON.stringify(active.state));
  } catch {
    // Ignore quota errors. The account copy is the one that matters.
  }
}

async function fetchRemote(): Promise<ScenarioStore | null | 'offline'> {
  try {
    const res = await fetch(API, { headers: { 'x-retirement-planner': '1' }, cache: 'no-store' });
    if (!res.ok) return 'offline';
    const body = (await res.json()) as unknown;
    return normalizeStore(body);
  } catch {
    return 'offline';
  }
}

async function putRemote(store: ScenarioStore): Promise<boolean> {
  try {
    const res = await fetch(API, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-retirement-planner': '1' },
      body: JSON.stringify(store),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function useAppState() {
  const [store, setStore] = useState<ScenarioStore | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('loading');
  const hydrated = useRef(false);
  const remoteOk = useRef(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const remote = await fetchRemote();
      if (cancel) return;
      if (remote === 'offline') {
        remoteOk.current = false;
        setStore(readLocal());
        setSaveStatus('local-only');
      } else if (!remote) {
        const local = readLocal();
        remoteOk.current = true;
        setStore(local);
        setSaveStatus('saving');
        const ok = await putRemote(local);
        if (!cancel) setSaveStatus(ok ? 'saved' : 'error');
      } else {
        remoteOk.current = true;
        writeLocal(remote);
        setStore(remote);
        setSaveStatus('saved');
      }
      hydrated.current = true;
    })();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!store || !hydrated.current) return;
    writeLocal(store);
    if (!remoteOk.current) return;
    setSaveStatus('saving');
    const handle = setTimeout(() => {
      putRemote(store).then((ok) => setSaveStatus(ok ? 'saved' : 'error'));
    }, 700);
    return () => clearTimeout(handle);
  }, [store]);

  const active = store?.scenarios.find((s) => s.id === store.activeId) ?? store?.scenarios[0];
  const state = active?.state ?? DEFAULT_STATE;

  const patchActive = useCallback((recipe: (current: AppState) => AppState) => {
    setStore((current) => {
      if (!current) return current;
      return {
        ...current,
        scenarios: current.scenarios.map((s) =>
          s.id === current.activeId ? { ...s, updatedAt: Date.now(), state: recipe(s.state) } : s,
        ),
      };
    });
  }, []);

  const updatePerson1 = useCallback(
    (updates: Partial<AppState['person1']>) => {
      patchActive((s) => ({ ...s, person1: { ...s.person1, ...updates } }));
    },
    [patchActive],
  );

  const updatePerson2 = useCallback(
    (updates: Partial<AppState['person2']>) => {
      patchActive((s) => ({ ...s, person2: { ...s.person2, ...updates } }));
    },
    [patchActive],
  );

  const updateExpenses = useCallback(
    (expenses: AppState['expenses']) => {
      patchActive((s) => ({ ...s, expenses }));
    },
    [patchActive],
  );

  const updateMortgage = useCallback(
    (updates: Partial<AppState['mortgage']>) => {
      patchActive((s) => ({ ...s, mortgage: { ...s.mortgage, ...updates } }));
    },
    [patchActive],
  );

  const updateFutureMortgage = useCallback(
    (updates: Partial<AppState['futureMortgage']>) => {
      patchActive((s) => ({ ...s, futureMortgage: { ...s.futureMortgage, ...updates } }));
    },
    [patchActive],
  );

  const updateAssumptions = useCallback(
    (updates: Partial<AppState['assumptions']>) => {
      patchActive((s) => ({ ...s, assumptions: { ...s.assumptions, ...updates } }));
    },
    [patchActive],
  );

  const resetToDefaults = useCallback(() => {
    patchActive(() => DEFAULT_STATE);
  }, [patchActive]);

  const selectScenario = useCallback((id: string) => {
    setStore((current) => {
      if (!current || !current.scenarios.some((s) => s.id === id)) return current;
      return { ...current, activeId: id };
    });
  }, []);

  const renameScenario = useCallback((name: string) => {
    const trimmed = name.trim().slice(0, 80);
    if (!trimmed) return;
    setStore((current) => {
      if (!current) return current;
      return {
        ...current,
        scenarios: current.scenarios.map((s) =>
          s.id === current.activeId ? { ...s, name: trimmed, updatedAt: Date.now() } : s,
        ),
      };
    });
  }, []);

  const saveScenarioAs = useCallback((name: string) => {
    const trimmed = name.trim().slice(0, 80);
    if (!trimmed) return;
    const id = newId();
    setStore((current) => {
      if (!current) return current;
      const source = current.scenarios.find((s) => s.id === current.activeId) ?? current.scenarios[0];
      return {
        activeId: id,
        scenarios: [
          ...current.scenarios,
          { id, name: trimmed, updatedAt: Date.now(), state: source.state },
        ],
      };
    });
  }, []);

  const deleteScenario = useCallback(() => {
    setStore((current) => {
      if (!current || current.scenarios.length <= 1) return current;
      const scenarios = current.scenarios.filter((s) => s.id !== current.activeId);
      return { activeId: scenarios[0].id, scenarios };
    });
  }, []);

  const retrySave = useCallback(() => {
    setStore((current) => (current ? { ...current, scenarios: [...current.scenarios] } : current));
  }, []);

  const exportJSON = useCallback(() => {
    if (!store) return;
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'retirement-scenarios.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [store]);

  const importJSON = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as unknown;
        const imported = normalizeStore(parsed);
        if (imported) {
          setStore(imported);
          return;
        }
        const single = mergeState(parsed as Partial<AppState>);
        const id = newId();
        setStore((current) => {
          const base = current ?? freshStore();
          return {
            activeId: id,
            scenarios: [...base.scenarios, { id, name: 'Imported plan', updatedAt: Date.now(), state: single }],
          };
        });
      } catch {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  }, []);

  return {
    ready: store !== null,
    state,
    saveStatus,
    scenarios: store?.scenarios.map((s) => ({ id: s.id, name: s.name })) ?? [],
    activeScenarioId: store?.activeId ?? '',
    activeScenarioName: active?.name ?? '',
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
  };
}
