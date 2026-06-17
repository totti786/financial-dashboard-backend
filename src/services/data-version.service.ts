// ============================================================================
// Data Version Service — tracks data version and manages SSE clients
// ============================================================================

let currentVersion = Date.now();
const clients = new Set<(data: string) => void>();

export interface DataVersion {
  version: number;
  last_sync: string | null;
}

export function getDataVersion(): DataVersion {
  return { version: currentVersion, last_sync: null };
}

export function bumpVersion(): void {
  currentVersion = Date.now();
  const data = JSON.stringify({ version: currentVersion });
  for (const send of clients) {
    try {
      send(data);
    } catch {
      clients.delete(send);
    }
  }
}

export function addClient(send: (data: string) => void): void {
  clients.add(send);
}

export function removeClient(send: (data: string) => void): void {
  clients.delete(send);
}
