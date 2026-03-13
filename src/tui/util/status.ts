/**
 * Status utilities
 */

import type { SessionStatus } from "@/core/types"

export const STATUS_ICONS: Record<SessionStatus, string> = {
  running: "●",
  background: "◍",
  waiting: "!",
  idle: "○",
  stopped: "◻",
  error: "✗",
  hibernated: "◉"
}

export const UNVIEWED_ICON = "●"
