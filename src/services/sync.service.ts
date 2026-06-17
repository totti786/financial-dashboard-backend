// ============================================================================
// Sync Service — sync status, trigger, and data version stubs
// ============================================================================

export interface SyncStatus {
  status: 'idle' | 'running' | 'success' | 'error';
  last_sync: string | null;
  error: string | null;
}

export interface SyncResult {
  success: boolean;
  message: string;
}

export interface CheckResult {
  success: boolean;
  sync_needed: boolean;
}

// ── In-memory sync state (will be replaced by proper sync engine) ─────────

let syncState: SyncStatus = {
  status: 'idle',
  last_sync: null,
  error: null,
};

export function getSyncStatus(): SyncStatus {
  return { ...syncState };
}

export function triggerSync(): SyncResult {
  // Stub: actual sync logic will be implemented later
  syncState = {
    status: 'running',
    last_sync: new Date().toISOString(),
    error: null,
  };

  // Simulate completion
  syncState = {
    status: 'success',
    last_sync: new Date().toISOString(),
    error: null,
  };

  return { success: true, message: 'Sync started' };
}

export function checkSync(): CheckResult {
  return { success: true, sync_needed: false };
}
