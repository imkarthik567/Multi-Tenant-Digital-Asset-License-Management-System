// ==============================================================================
// AssetVault: Synchronous React Query Cache Persistence & Hydration
// Eliminates empty/skeleton flash on browser page reload (Ctrl+R)
// ==============================================================================

import { QueryClient } from '@tanstack/react-query';

const CACHE_PREFIX = 'assetvault_rq_cache_v2_';

interface PersistedQueryEntry {
  queryKey: readonly unknown[];
  data: unknown;
  dataUpdatedAt: number;
}

function getActiveTenantCacheKey(explicitTenantId?: string | null): string | null {
  try {
    if (explicitTenantId) {
      return `${CACHE_PREFIX}${explicitTenantId}`;
    }
    const raw =
      localStorage.getItem('assetvault_session_cache') ||
      sessionStorage.getItem('assetvault_session_cache');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const tenantId =
      parsed?.tenant?.id ||
      parsed?.user?.tenantId ||
      parsed?.user?.tenant?.id ||
      (parsed?.user?.isSuperAdmin ? 'super-admin' : null);
    if (!tenantId) return null;
    return `${CACHE_PREFIX}${tenantId}`;
  } catch {
    return null;
  }
}

/**
 * Synchronously hydrates the QueryClient from localStorage before the first React render
 * so page reloads (Ctrl+R) render cached data on frame 0 without wiping the UI.
 */
export function hydrateQueryClientFromStorage(
  queryClient: QueryClient,
  explicitTenantId?: string | null
): void {
  try {
    const storageKey = getActiveTenantCacheKey(explicitTenantId);
    if (!storageKey) return;

    const raw = localStorage.getItem(storageKey);
    if (!raw) return;

    const entries: PersistedQueryEntry[] = JSON.parse(raw);
    if (!Array.isArray(entries)) return;

    const now = Date.now();
    for (const entry of entries) {
      if (entry && Array.isArray(entry.queryKey) && entry.data !== undefined) {
        queryClient.setQueryData(entry.queryKey, entry.data, {
          updatedAt: entry.dataUpdatedAt || now - 5000,
        });
      }
    }
  } catch {
    // Ignore corrupt cache entries
  }
}

/**
 * Persists all successful queries in QueryClient to localStorage for the active tenant.
 */
export function flushQueryCacheToStorage(
  queryClient: QueryClient,
  explicitTenantId?: string | null
): void {
  try {
    const storageKey = getActiveTenantCacheKey(explicitTenantId);
    if (!storageKey) return;

    const queries = queryClient.getQueryCache().getAll();
    const persisted: PersistedQueryEntry[] = [];

    for (const q of queries) {
      if (q.state.status === 'success' && q.state.data !== undefined) {
        persisted.push({
          queryKey: q.queryKey,
          data: q.state.data,
          dataUpdatedAt: q.state.dataUpdatedAt || Date.now(),
        });
      }
    }

    if (persisted.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(persisted.slice(-60)));
    }
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Subscribes to QueryClient cache updates to keep localStorage synchronized automatically.
 */
export function attachQueryCachePersistence(queryClient: QueryClient): () => void {
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;

  const scheduleSave = () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      flushQueryCacheToStorage(queryClient);
    }, 120);
  };

  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (
      event?.type === 'updated' &&
      event.query?.state?.status === 'success' &&
      event.query?.state?.data !== undefined
    ) {
      scheduleSave();
    }
  });

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      flushQueryCacheToStorage(queryClient);
    });
  }

  return unsubscribe;
}

/**
 * Clears persisted React Query cache (for logout or organization closure).
 */
export function clearPersistedQueryCache(tenantId?: string | null): void {
  try {
    if (tenantId) {
      localStorage.removeItem(`${CACHE_PREFIX}${tenantId}`);
      return;
    }
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}
}
