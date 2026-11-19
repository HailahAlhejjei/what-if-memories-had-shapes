// Everything here stays in this browser. Nothing is sent anywhere.
import type { MemoryProfile } from '../memory/types';

const KEY = 'shape-of-a-memory:saved';

function safeGet(): MemoryProfile[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function listSaved(): MemoryProfile[] { return safeGet(); }

export function saveMemory(p: MemoryProfile): boolean {
  try {
    const list = safeGet().filter((m) => m.id !== p.id);
    list.unshift(p);
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 24)));
    return true;
  } catch { return false; }
}

export function deleteSaved(id: string) {
  try { localStorage.setItem(KEY, JSON.stringify(safeGet().filter((m) => m.id !== id))); } catch { /* ignore */ }
}

// Session-only API key: never written to localStorage.
const KEY_API = 'shape-of-a-memory:apikey';
export function getApiKey(): string { try { return sessionStorage.getItem(KEY_API) || ''; } catch { return ''; } }
export function setApiKey(k: string) { try { k ? sessionStorage.setItem(KEY_API, k) : sessionStorage.removeItem(KEY_API); } catch { /* ignore */ } }
