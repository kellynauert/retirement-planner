import { useState, useEffect, useCallback } from 'react';
import type { AppState } from '../engine/types';
import { DEFAULT_STATE } from '../engine/defaults';

const STORAGE_KEY = 'retirement-planner-v1';

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as AppState;
    // Merge with defaults to handle new fields added in app updates
    return {
      person1: { ...DEFAULT_STATE.person1, ...parsed.person1 },
      person2: { ...DEFAULT_STATE.person2, ...parsed.person2 },
      expenses: parsed.expenses ?? DEFAULT_STATE.expenses,
      assumptions: { ...DEFAULT_STATE.assumptions, ...parsed.assumptions },
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota errors
  }
}

export function useAppState() {
  const [state, setState] = useState<AppState>(loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const updatePerson1 = useCallback((updates: Partial<AppState['person1']>) => {
    setState((s) => ({ ...s, person1: { ...s.person1, ...updates } }));
  }, []);

  const updatePerson2 = useCallback((updates: Partial<AppState['person2']>) => {
    setState((s) => ({ ...s, person2: { ...s.person2, ...updates } }));
  }, []);

  const updateExpenses = useCallback((expenses: AppState['expenses']) => {
    setState((s) => ({ ...s, expenses }));
  }, []);

  const updateAssumptions = useCallback((updates: Partial<AppState['assumptions']>) => {
    setState((s) => ({ ...s, assumptions: { ...s.assumptions, ...updates } }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  const exportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'retirement-plan.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [state]);

  const importJSON = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as AppState;
        setState({
          person1: { ...DEFAULT_STATE.person1, ...parsed.person1 },
          person2: { ...DEFAULT_STATE.person2, ...parsed.person2 },
          expenses: parsed.expenses ?? DEFAULT_STATE.expenses,
          assumptions: { ...DEFAULT_STATE.assumptions, ...parsed.assumptions },
        });
      } catch {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  }, []);

  return {
    state,
    updatePerson1,
    updatePerson2,
    updateExpenses,
    updateAssumptions,
    resetToDefaults,
    exportJSON,
    importJSON,
  };
}
