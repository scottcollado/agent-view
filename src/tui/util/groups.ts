/**
 * Group utility functions for organizing sessions
 */

import type { Session, Group } from "@/core/types"
import { sortSessionsByCreatedAt } from "./session"

export interface GroupedItem {
  type: "group" | "session"
  group?: Group
  session?: Session
  groupPath: string
  isLast: boolean
  groupIndex?: number  // 1-9 for hotkey jumps
}

export const DEFAULT_GROUP_PATH = "my-sessions"
export const DEFAULT_GROUP_NAME = "My Sessions"

export function ensureDefaultGroup(groups: Group[]): Group[] {
  const hasDefault = groups.some(g => g.path === DEFAULT_GROUP_PATH)
  if (hasDefault) return groups

  const defaultGroup: Group = {
    path: DEFAULT_GROUP_PATH,
    name: DEFAULT_GROUP_NAME,
    expanded: true,
    order: 0,
    defaultPath: ""
  }

  // Insert at beginning and adjust orders
  return [defaultGroup, ...groups.map(g => ({ ...g, order: g.order + 1 }))]
}

/**
 * Flatten groups and sessions into a navigable list
 * Returns an array where each item is either a group header or a session
 */
/**
 * Check if a session needs immediate attention (should break out of groups)
 */
function needsAttention(s: Session): boolean {
  return s.status === "waiting" || (!s.acknowledged && s.status === "idle")
}

export function flattenGroupTree(sessions: Session[], groups: Group[]): GroupedItem[] {
  const result: GroupedItem[] = []

  // Pull out sessions that need attention — they go at the very top, ungrouped
  const attentionSessions: Session[] = []
  const attentionIds = new Set<string>()
  for (const session of sessions) {
    if (needsAttention(session)) {
      attentionSessions.push(session)
      attentionIds.add(session.id)
    }
  }

  // Sort attention sessions: waiting first, then unviewed
  if (attentionSessions.length > 0) {
    const sorted = sortSessionsByCreatedAt(attentionSessions)
    for (let i = 0; i < sorted.length; i++) {
      result.push({
        type: "session",
        session: sorted[i],
        groupPath: sorted[i].groupPath || DEFAULT_GROUP_PATH,
        isLast: i === sorted.length - 1
      })
    }
  }

  // Sort groups by order
  const sortedGroups = [...groups].sort((a, b) => a.order - b.order)

  // Create a map of groupPath -> sessions (excluding attention sessions)
  const sessionsByGroup = new Map<string, Session[]>()
  for (const session of sessions) {
    if (attentionIds.has(session.id)) continue
    const groupPath = session.groupPath || DEFAULT_GROUP_PATH
    const existing = sessionsByGroup.get(groupPath) || []
    existing.push(session)
    sessionsByGroup.set(groupPath, existing)
  }

  // Sort sessions within each group
  for (const [path, groupSessions] of sessionsByGroup) {
    sessionsByGroup.set(path, sortSessionsByCreatedAt(groupSessions))
  }

  // Build grouped list
  let groupIndex = 1
  for (const group of sortedGroups) {
    const groupSessions = sessionsByGroup.get(group.path) || []

    // Add group header
    result.push({
      type: "group",
      group,
      groupPath: group.path,
      isLast: false,
      groupIndex: groupIndex <= 9 ? groupIndex : undefined
    })
    groupIndex++

    // If expanded, add sessions
    if (group.expanded) {
      for (let i = 0; i < groupSessions.length; i++) {
        result.push({
          type: "session",
          session: groupSessions[i],
          groupPath: group.path,
          isLast: i === groupSessions.length - 1
        })
      }
    }
  }

  // Handle orphan sessions (in groups that don't exist)
  const knownGroupPaths = new Set(sortedGroups.map(g => g.path))
  for (const [path, groupSessions] of sessionsByGroup) {
    if (!knownGroupPaths.has(path)) {
      // Create implicit group for orphans
      result.push({
        type: "group",
        group: {
          path,
          name: path,
          expanded: true,
          order: 999,
          defaultPath: ""
        },
        groupPath: path,
        isLast: false,
        groupIndex: groupIndex <= 9 ? groupIndex : undefined
      })
      groupIndex++

      for (let i = 0; i < groupSessions.length; i++) {
        result.push({
          type: "session",
          session: groupSessions[i],
          groupPath: path,
          isLast: i === groupSessions.length - 1
        })
      }
    }
  }

  return result
}

export function getGroupSessionCount(sessions: Session[], groupPath: string): number {
  return sessions.filter(s => (s.groupPath || DEFAULT_GROUP_PATH) === groupPath).length
}

export function getGroupStatusSummary(sessions: Session[], groupPath: string): {
  running: number
  waiting: number
  error: number
} {
  const groupSessions = sessions.filter(s => (s.groupPath || DEFAULT_GROUP_PATH) === groupPath)
  return {
    running: groupSessions.filter(s => s.status === "running").length,
    waiting: groupSessions.filter(s => s.status === "waiting").length,
    error: groupSessions.filter(s => s.status === "error").length
  }
}

export function generateGroupPath(name: string, existingPaths: string[]): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  let path = base || "group"
  let counter = 1

  while (existingPaths.includes(path)) {
    path = `${base}-${counter}`
    counter++
  }

  return path
}
