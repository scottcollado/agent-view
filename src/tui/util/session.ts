/**
 * Session utilities
 */

import type { Session, SessionStatus } from "@/core/types"

/**
 * Sort priority for a session, combining status and acknowledged state.
 * Lower = shown first. Waiting > unviewed > error > running > idle > stopped > hibernated.
 */
function sortKey(s: Session): number {
  if (s.status === "waiting") return 0
  if (!s.acknowledged && (s.status === "idle" || s.status === "error")) return 1
  if (s.status === "error") return 2
  if (s.status === "running") return 3
  if (s.status === "background") return 4
  if (s.status === "idle") return 5
  if (s.status === "stopped") return 6
  return 7 // hibernated
}

/**
 * Sort sessions: waiting first, then unviewed, then by status, then newest first.
 */
export function sortSessionsByCreatedAt(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => {
    const pa = sortKey(a)
    const pb = sortKey(b)
    if (pa !== pb) return pa - pb
    return b.createdAt.getTime() - a.createdAt.getTime()
  })
}
