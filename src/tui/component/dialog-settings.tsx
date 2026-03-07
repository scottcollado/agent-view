/**
 * Settings dialog
 * Exposes all config.json settings in the TUI
 */

import { useDialog } from "@tui/ui/dialog"
import { DialogSelect } from "@tui/ui/dialog-select"
import { DialogInput } from "@tui/ui/dialog-input"
import { useToast } from "@tui/ui/toast"
import { useTheme } from "@tui/context/theme"
import { useSync } from "@tui/context/sync"
import { getConfig, loadConfig, saveConfig, type RemoteConfig } from "@/core/config"
import type { Tool } from "@/core/types"

const TOOL_OPTIONS: { title: string; value: Tool }[] = [
  { title: "Claude Code", value: "claude" },
  { title: "OpenCode", value: "opencode" },
  { title: "Gemini CLI", value: "gemini" },
  { title: "Codex CLI", value: "codex" },
  { title: "Custom", value: "custom" },
  { title: "Shell", value: "shell" },
]

const HIBERNATE_OPTIONS = [
  { title: "Disabled", value: 0 },
  { title: "30 minutes", value: 30 },
  { title: "1 hour", value: 60 },
  { title: "2 hours", value: 120 },
  { title: "4 hours", value: 240 },
]

function formatHibernate(minutes: number): string {
  if (!minutes) return "Disabled"
  if (minutes < 60) return `${minutes}m`
  return `${minutes / 60}h`
}

export function DialogSettings() {
  const dialog = useDialog()
  const toast = useToast()
  const themeCtx = useTheme()
  const sync = useSync()

  function showSettingsList() {
    const config = getConfig()

    const remoteCount = Object.keys(config.remotes || {}).length
    const options = [
      {
        title: "Default tool",
        value: "defaultTool" as const,
        footer: config.defaultTool || "claude",
      },
      {
        title: "Theme",
        value: "theme" as const,
        footer: `${themeCtx.selected} (${themeCtx.mode()})`,
      },
      {
        title: "Default group",
        value: "defaultGroup" as const,
        footer: config.defaultGroup || "default",
      },
      {
        title: "Auto-hibernate idle sessions",
        value: "autoHibernate" as const,
        footer: formatHibernate(config.autoHibernateMinutes || 0),
      },
      {
        title: "Remote hosts",
        value: "remotes" as const,
        footer: remoteCount > 0 ? `${remoteCount} configured` : "none",
      },
    ]

    dialog.replace(() => (
      <DialogSelect
        title="Settings"
        options={options}
        skipFilter
        onSelect={(opt) => {
          switch (opt.value) {
            case "defaultTool": return showDefaultTool()
            case "theme": return showTheme()
            case "defaultGroup": return showDefaultGroup()
            case "autoHibernate": return showAutoHibernate()
            case "remotes": return showRemotes()
          }
        }}
      />
    ))
  }

  async function updateConfig(updater: (config: Awaited<ReturnType<typeof loadConfig>>) => Awaited<ReturnType<typeof loadConfig>>) {
    const config = await loadConfig()
    await saveConfig(updater(config))
    toast.show({ message: "Setting saved", variant: "success", duration: 1500 })
    showSettingsList()
  }

  function showDefaultTool() {
    const config = getConfig()
    dialog.replace(() => (
      <DialogSelect
        title="Default tool"
        options={TOOL_OPTIONS}
        current={config.defaultTool || "claude"}
        skipFilter
        onSelect={(opt) => updateConfig((c) => ({ ...c, defaultTool: opt.value }))}
      />
    ))
  }

  function showTheme() {
    const themeNames = themeCtx.all()
    const modes = ["dark", "light"] as const

    const options = themeNames.flatMap((name) =>
      modes.map((mode) => ({
        title: `${name}`,
        value: { name, mode },
        description: mode,
      }))
    )

    const current = { name: themeCtx.selected, mode: themeCtx.mode() }
    dialog.replace(() => (
      <DialogSelect
        title="Theme"
        options={options}
        current={current}
        skipFilter
        onSelect={(opt) => {
          themeCtx.set(opt.value.name)
          themeCtx.setMode(opt.value.mode)
          updateConfig((c) => ({ ...c, theme: opt.value.name }))
        }}
      />
    ))
  }

  function showDefaultGroup() {
    const config = getConfig()
    const groups = sync.group.list()
    const options = groups.map((g) => ({
      title: g.name,
      value: g.path,
    }))
    dialog.replace(() => (
      <DialogSelect
        title="Default group"
        options={options}
        current={config.defaultGroup || "default"}
        skipFilter
        onSelect={(opt) => updateConfig((c) => ({ ...c, defaultGroup: opt.value }))}
      />
    ))
  }

  function showAutoHibernate() {
    const config = getConfig()
    dialog.replace(() => (
      <DialogSelect
        title="Auto-hibernate idle sessions"
        options={HIBERNATE_OPTIONS}
        current={config.autoHibernateMinutes || 0}
        skipFilter
        onSelect={(opt) => updateConfig((c) => ({ ...c, autoHibernateMinutes: opt.value, autoHibernatePrompted: true }))}
      />
    ))
  }

  function showRemotes() {
    const config = getConfig()
    const remotes = config.remotes || {}
    const remoteNames = Object.keys(remotes)

    const options = [
      { title: "+ Add remote", value: { action: "add" } as const },
      ...remoteNames.map(name => ({
        title: name,
        value: { action: "edit" as const, name },
        footer: remotes[name]!.host
      }))
    ]

    dialog.replace(() => (
      <DialogSelect
        title="Remote hosts"
        options={options}
        skipFilter
        onSelect={(opt) => {
          if (opt.value.action === "add") {
            showAddRemote()
          } else {
            showEditRemote(opt.value.name)
          }
        }}
      />
    ))
  }

  function showAddRemote() {
    dialog.replace(() => (
      <DialogInput
        title="Add remote - Name"
        placeholder="devbox"
        onSubmit={(name) => {
          if (!name.trim()) {
            toast.show({ message: "Name is required", variant: "error", duration: 2000 })
            showRemotes()
            return
          }
          const config = getConfig()
          if (config.remotes?.[name]) {
            toast.show({ message: "Remote already exists", variant: "error", duration: 2000 })
            showRemotes()
            return
          }
          showAddRemoteHost(name.trim())
        }}
      />
    ))
  }

  function showAddRemoteHost(name: string) {
    dialog.replace(() => (
      <DialogInput
        title={`Add remote "${name}" - SSH host`}
        placeholder="user@hostname"
        onSubmit={(host) => {
          if (!host.trim()) {
            toast.show({ message: "Host is required", variant: "error", duration: 2000 })
            showRemotes()
            return
          }
          showAddRemoteAvPath(name, host.trim())
        }}
      />
    ))
  }

  function showAddRemoteAvPath(name: string, host: string) {
    dialog.replace(() => (
      <DialogInput
        title={`Add remote "${name}" - av path (optional)`}
        placeholder="av"
        onSubmit={async (avPath) => {
          const config = await loadConfig()
          const remotes = { ...config.remotes }
          remotes[name] = {
            host,
            avPath: avPath.trim() || undefined
          }
          await saveConfig({ ...config, remotes })
          toast.show({ message: `Added remote "${name}"`, variant: "success", duration: 2000 })
          sync.refreshRemote()
          showRemotes()
        }}
      />
    ))
  }

  function showEditRemote(name: string) {
    const config = getConfig()
    const remote = config.remotes?.[name]
    if (!remote) {
      showRemotes()
      return
    }

    const options = [
      { title: "Edit host", value: "host" as const, footer: remote.host },
      { title: "Edit av path", value: "avPath" as const, footer: remote.avPath || "av" },
      { title: "Remove", value: "remove" as const },
      { title: "Back", value: "back" as const },
    ]

    dialog.replace(() => (
      <DialogSelect
        title={`Remote: ${name}`}
        options={options}
        skipFilter
        onSelect={(opt) => {
          switch (opt.value) {
            case "host":
              showEditRemoteHost(name, remote)
              break
            case "avPath":
              showEditRemoteAvPath(name, remote)
              break
            case "remove":
              showRemoveRemote(name)
              break
            case "back":
              showRemotes()
              break
          }
        }}
      />
    ))
  }

  function showEditRemoteHost(name: string, remote: RemoteConfig) {
    dialog.replace(() => (
      <DialogInput
        title={`Edit "${name}" - SSH host`}
        placeholder={remote.host}
        initialValue={remote.host}
        onSubmit={async (host) => {
          if (!host.trim()) {
            toast.show({ message: "Host is required", variant: "error", duration: 2000 })
            showEditRemote(name)
            return
          }
          const config = await loadConfig()
          const remotes = { ...config.remotes }
          remotes[name] = { ...remote, host: host.trim() }
          await saveConfig({ ...config, remotes })
          toast.show({ message: "Host updated", variant: "success", duration: 1500 })
          sync.refreshRemote()
          showEditRemote(name)
        }}
      />
    ))
  }

  function showEditRemoteAvPath(name: string, remote: RemoteConfig) {
    dialog.replace(() => (
      <DialogInput
        title={`Edit "${name}" - av path`}
        placeholder="av"
        initialValue={remote.avPath || "av"}
        onSubmit={async (avPath) => {
          const config = await loadConfig()
          const remotes = { ...config.remotes }
          remotes[name] = { ...remote, avPath: avPath.trim() || undefined }
          await saveConfig({ ...config, remotes })
          toast.show({ message: "av path updated", variant: "success", duration: 1500 })
          sync.refreshRemote()
          showEditRemote(name)
        }}
      />
    ))
  }

  function showRemoveRemote(name: string) {
    dialog.replace(() => (
      <DialogSelect
        title={`Remove remote "${name}"?`}
        options={[
          { title: "Remove", value: "remove" },
          { title: "Cancel", value: "cancel" },
        ]}
        skipFilter
        onSelect={async (opt) => {
          if (opt.value === "remove") {
            const config = await loadConfig()
            const remotes = { ...config.remotes }
            delete remotes[name]
            await saveConfig({ ...config, remotes })
            toast.show({ message: `Removed remote "${name}"`, variant: "info", duration: 2000 })
            sync.refreshRemote()
          }
          showRemotes()
        }}
      />
    ))
  }

  // Show the settings list on mount
  showSettingsList()

  return <></>
}
