/**
 * Auto-updater (disabled in fork — manual updates only)
 * To update: git pull && bun install && bun run compile
 */

export async function checkForUpdate(): Promise<{ current: string; latest: string } | null> {
  return null
}

export function performUpdateSync(): void {
  // No-op: auto-update disabled for security
}
