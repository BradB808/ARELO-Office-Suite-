import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AnleoDocument, AnyContent, AppKind, RecentEntry, Template } from './shared/types'
import {
  autosave,
  extFor,
  listRecents,
  loadDraft,
  newDocument,
  openDocumentDialog,
  openDocumentFromPath,
  removeRecent,
  saveDocument,
  saveDocumentAs,
  saveDocumentCopyAs,
} from './shared/documents'
import { getExporters } from './shared/exporters'
import { blankContent, APP_NAMES, NEW_TITLES } from './shared/blank'
import { platform } from './shared/platform'
import { Home } from './hub/Home'
import { TemplateGallery } from './hub/TemplateGallery'
import { Modal, Select, Button, MenuButton, type MenuItem } from './shared/ui'
import { AppGlyph, IcHome, IcSettings, IcSun, IcMoon, IcChevronL, IcFolder } from './shared/icons'
import { CommandPalette } from './shell/CommandPalette'
import { ShortcutsHelp } from './shell/ShortcutsHelp'
import { registerCommands, type Command } from './shared/commands'
import { AiSettingsFields } from './shared/AiSettings'
import { PrivacyPanel } from './shared/PrivacyPanel'
import DocsApp from './apps/docs/DocsApp'
import SheetsApp from './apps/sheets/SheetsApp'
import SlidesApp from './apps/slides/SlidesApp'

type Route = { view: 'home' } | { view: 'templates' } | { view: 'editor'; kind: AppKind }

type ThemePref = 'system' | 'light' | 'dark'

interface Settings {
  theme: ThemePref
}

export default function App() {
  const [route, setRoute] = useState<Route>({ view: 'home' })
  const [docs, setDocs] = useState<Partial<Record<AppKind, AnleoDocument>>>({})
  const [recents, setRecents] = useState<RecentEntry[]>([])
  const [settings, setSettings] = useState<Settings>({ theme: 'light' })
  const [showSettings, setShowSettings] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [saveToast, setSaveToast] = useState<string | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    setSaveToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setSaveToast(null), 3200)
  }, [])
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isDark = settings.theme === 'dark' || (settings.theme === 'system' && systemDark)

  // ---------- theme ----------
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
  }, [isDark])

  useEffect(() => {
    platform.storeGet<Settings>('settings').then((s) => {
      if (s?.theme) setSettings(s)
    })
    refreshRecents()
  }, [])

  const setTheme = (theme: ThemePref) => {
    const next = { ...settings, theme }
    setSettings(next)
    platform.storeSet('settings', next)
  }

  const refreshRecents = () => listRecents().then(setRecents)

  // ---------- document lifecycle ----------

  const currentKind: AppKind | null = route.view === 'editor' ? route.kind : null
  const currentDoc = currentKind ? (docs[currentKind] ?? null) : null

  const scheduleAutosave = useCallback((doc: AnleoDocument) => {
    setSaveState('saving')
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(async () => {
      await autosave(doc)
      setSaveState('saved')
      listRecents().then(setRecents)
    }, 700)
  }, [])

  const openInEditor = useCallback(
    (doc: AnleoDocument) => {
      setDocs((d) => ({ ...d, [doc.meta.kind]: doc }))
      setRoute({ view: 'editor', kind: doc.meta.kind })
      setSaveState('saved')
    },
    [],
  )

  const handleNew = useCallback(
    (kind: AppKind, template?: Template) => {
      const content = template ? template.make() : blankContent(kind)
      const title = template ? template.name : NEW_TITLES[kind]
      const doc = newDocument(kind, title, content)
      openInEditor(doc)
      scheduleAutosave(doc)
    },
    [openInEditor, scheduleAutosave],
  )

  const handleOpenRecent = useCallback(
    async (entry: RecentEntry) => {
      let doc = await loadDraft(entry.id)
      if (!doc && entry.filePath) doc = await openDocumentFromPath(entry.filePath)
      if (doc) openInEditor(doc)
      else {
        await removeRecent(entry.id)
        refreshRecents()
      }
    },
    [openInEditor],
  )

  const handleOpenDialog = useCallback(async () => {
    const doc = await openDocumentDialog()
    if (doc) {
      openInEditor(doc)
      refreshRecents()
    }
  }, [openInEditor])

  const handleRemoveRecent = useCallback(async (id: string) => {
    await removeRecent(id)
    refreshRecents()
  }, [])

  const handleDocChange = useCallback(
    (kind: AppKind, content: AnyContent) => {
      setDocs((d) => {
        const doc = d[kind]
        if (!doc) return d
        const next = { ...doc, content, meta: { ...doc.meta, updatedAt: Date.now() } }
        scheduleAutosave(next)
        return { ...d, [kind]: next }
      })
    },
    [scheduleAutosave],
  )

  const handleTitleChange = useCallback(
    (kind: AppKind, title: string) => {
      setDocs((d) => {
        const doc = d[kind]
        if (!doc) return d
        const next = { ...doc, meta: { ...doc.meta, title } }
        scheduleAutosave(next)
        return { ...d, [kind]: next }
      })
    },
    [scheduleAutosave],
  )

  const requestSave = useCallback(
    async (saveAs = false) => {
      const kind = currentKind
      if (!kind) return
      const doc = docs[kind]
      if (!doc) return
      setSaveState('saving')
      const result = saveAs ? await saveDocumentAs(doc) : await saveDocument(doc)
      if (result.saved) {
        // filePath may have been set by the save dialog
        setDocs((d) => ({ ...d, [kind]: { ...doc } }))
        await autosave(doc)
        refreshRecents()
        if (result.fileName) showToast(`Saved “${result.fileName}”`)
      } else if (result.error) {
        showToast(`Couldn’t save: ${result.error}`)
      }
      setSaveState('saved')
    },
    [currentKind, docs],
  )

  const handleCopyAs = useCallback(
    async (ext: string) => {
      const kind = currentKind
      if (!kind) return
      const doc = docs[kind]
      if (!doc) return
      setSaveState('saving')
      const result = await saveDocumentCopyAs(doc, ext)
      if (result.saved && result.fileName) showToast(`Saved “${result.fileName}”`)
      else if (result.error) showToast(`Couldn’t save: ${result.error}`)
      setSaveState('saved')
    },
    [currentKind, docs, showToast],
  )

  // ---------- native menu + file associations + shortcuts ----------

  const stateRef = useRef({ requestSave, handleOpenDialog, handleNew, currentKind })
  stateRef.current = { requestSave, handleOpenDialog, handleNew, currentKind }

  useEffect(() => {
    platform.onMenu((action) => {
      const s = stateRef.current
      if (action === 'save') s.requestSave(false)
      if (action === 'save-as') s.requestSave(true)
      if (action === 'open') s.handleOpenDialog()
      if (action === 'new') s.handleNew(s.currentKind ?? 'docs')
      if (action === 'undo' || action === 'redo') {
        // Text fields and TipTap handle native undo; custom editors (sheets,
        // slides) listen for these window events instead.
        const el = document.activeElement as HTMLElement | null
        const editable =
          !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
        if (editable) {
          document.execCommand(action === 'undo' ? 'undo' : 'redo')
        } else {
          window.dispatchEvent(new CustomEvent('anleo-' + action))
        }
      }
    })
    platform.onOpenPath(async (p) => {
      const doc = await openDocumentFromPath(p)
      if (doc) openInEditor(doc)
    })
  }, [openInEditor])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const k = e.key.toLowerCase()
      // Cmd+K works in both the browser build and the packaged app.
      if (k === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
        return
      }
      if (k === '/') {
        e.preventDefault()
        setHelpOpen((o) => !o)
        return
      }
      if (platform.isElectron) return // native menu owns save/open
      if (k === 's') {
        e.preventDefault()
        stateRef.current.requestSave(e.shiftKey)
      } else if (k === 'o') {
        e.preventDefault()
        stateRef.current.handleOpenDialog()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ---------- global commands for the palette ----------

  useEffect(() => {
    const cmds: Command[] = [
      {
        id: 'new-doc',
        title: 'New document',
        group: 'Create',
        hint: 'Docs',
        keywords: 'word write letter',
        run: () => handleNew('docs'),
      },
      {
        id: 'new-sheet',
        title: 'New spreadsheet',
        group: 'Create',
        hint: 'Sheets',
        keywords: 'excel grid table',
        run: () => handleNew('sheets'),
      },
      {
        id: 'new-slides',
        title: 'New presentation',
        group: 'Create',
        hint: 'Slides',
        keywords: 'powerpoint deck',
        run: () => handleNew('slides'),
      },
      {
        id: 'browse-templates',
        title: 'Browse all templates',
        group: 'Create',
        keywords: 'gallery designs',
        run: () => setRoute({ view: 'templates' }),
      },
      { id: 'open-file', title: 'Open file…', group: 'File', hint: '⌘O', run: () => handleOpenDialog() },
      { id: 'save', title: 'Save', group: 'File', hint: '⌘S', run: () => requestSave(false) },
      { id: 'save-as', title: 'Save a copy as…', group: 'File', hint: '⇧⌘S', run: () => requestSave(true) },
      ...getExporters(currentKind ?? 'docs').map(
        (f): Command => ({
          id: 'export-' + f.ext,
          title: `Export as ${f.label} (.${f.ext})`,
          group: 'File',
          keywords: 'download save copy',
          run: () => handleCopyAs(f.ext),
        }),
      ),
      { id: 'go-home', title: 'Go to home', group: 'Navigate', run: () => setRoute({ view: 'home' }) },
      ...(['docs', 'sheets', 'slides'] as AppKind[]).map(
        (kind): Command => ({
          id: 'switch-' + kind,
          title: `Switch to ${APP_NAMES[kind]}`,
          group: 'Navigate',
          run: () => (docs[kind] ? setRoute({ view: 'editor', kind }) : handleNew(kind)),
        }),
      ),
      ...recents.slice(0, 12).map(
        (r): Command => ({
          id: 'recent-' + r.id,
          title: r.title,
          group: 'Recent documents',
          hint: APP_NAMES[r.kind].replace('Anleo ', ''),
          keywords: r.kind,
          run: () => handleOpenRecent(r),
        }),
      ),
      {
        id: 'toggle-theme',
        title: isDark ? 'Switch to light mode' : 'Switch to dark mode',
        group: 'App',
        keywords: 'appearance theme',
        run: () => setTheme(isDark ? 'light' : 'dark'),
      },
      {
        id: 'settings',
        title: 'Open settings',
        group: 'App',
        keywords: 'preferences ai api key openrouter',
        run: () => setShowSettings(true),
      },
    ]
    registerCommands('shell', cmds)
  }, [recents, docs, currentKind, isDark, handleNew, handleOpenDialog, handleOpenRecent, handleCopyAs, requestSave])

  // ---------- render ----------

  const editorProps = useMemo(() => {
    if (!currentKind || !currentDoc) return null
    return {
      doc: currentDoc,
      onDocChange: (c: AnyContent) => handleDocChange(currentKind, c),
      onTitleChange: (t: string) => handleTitleChange(currentKind, t),
      requestSave,
      requestOpen: handleOpenDialog,
      requestNew: () => handleNew(currentKind),
      goHome: () => setRoute({ view: 'home' }),
      isDark,
    }
  }, [currentKind, currentDoc, handleDocChange, handleTitleChange, requestSave, handleOpenDialog, handleNew, isDark])

  return (
    <div className="shell" data-app={currentKind ?? undefined}>
      <nav className={'rail' + (platform.isElectron ? ' mac-pad' : '')}>
        <div className="rail-logo" title="Anleo Office">
          <svg viewBox="0 0 40 40" width="30" height="30">
            <rect x="2" y="2" width="36" height="36" rx="9.5" fill="#1a1d24" />
            <g transform="rotate(-24 20 32.3)">
              <rect x="13.4" y="9.9" width="13.3" height="18.7" rx="2.1" fill="#f97316" />
            </g>
            <rect x="13.4" y="9" width="13.3" height="18.7" rx="2.1" fill="#10b981" />
            <g transform="rotate(24 20 32.3)">
              <rect x="13.4" y="9.9" width="13.3" height="18.7" rx="2.1" fill="#3b82f6" />
              <rect x="15.8" y="13" width="6.4" height="1.5" rx="0.75" fill="#fff" fillOpacity="0.9" />
              <rect x="15.8" y="16" width="8.6" height="1.1" rx="0.55" fill="#fff" fillOpacity="0.6" />
              <rect x="15.8" y="18.4" width="8.6" height="1.1" rx="0.55" fill="#fff" fillOpacity="0.6" />
            </g>
          </svg>
        </div>

        <button
          className={'rail-btn' + (route.view === 'home' ? ' active' : '')}
          title="Home"
          onClick={() => setRoute({ view: 'home' })}
        >
          <IcHome />
        </button>

        <div className="rail-sep" />

        {(['docs', 'sheets', 'slides'] as AppKind[]).map((kind) => (
          <button
            key={kind}
            className={'rail-btn app' + (currentKind === kind ? ' active' : '')}
            title={APP_NAMES[kind]}
            onClick={() => {
              if (docs[kind]) setRoute({ view: 'editor', kind })
              else handleNew(kind)
            }}
          >
            <AppGlyph kind={kind} size={30} />
            {docs[kind] && <span className={'rail-dot ' + kind} />}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        <button className="rail-btn" title="Shortcuts & commands (⌘/)" onClick={() => setHelpOpen(true)}>
          <svg viewBox="0 0 20 20" fill="none" width="17" height="17">
            <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M7.9 7.9a2.1 2.1 0 1 1 2.9 1.94c-.5.22-.8.72-.8 1.27v.3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle cx="10" cy="14.1" r="0.95" fill="currentColor" />
          </svg>
        </button>
        <button className="rail-btn" title={isDark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setTheme(isDark ? 'light' : 'dark')}>
          {isDark ? <IcSun /> : <IcMoon />}
        </button>
        <button className="rail-btn" title="Settings" onClick={() => setShowSettings(true)}>
          <IcSettings />
        </button>
      </nav>

      <div className="shell-main">
        {route.view === 'home' && (
          <Home
            recents={recents}
            onNew={handleNew}
            onOpenRecent={handleOpenRecent}
            onOpenFile={handleOpenDialog}
            onRemoveRecent={handleRemoveRecent}
            onBrowseTemplates={() => setRoute({ view: 'templates' })}
          />
        )}

        {route.view === 'templates' && (
          <TemplateGallery onNew={handleNew} goHome={() => setRoute({ view: 'home' })} />
        )}

        {route.view === 'editor' && currentDoc && editorProps && (
          <div className="editor-shell">
            <header className={'doc-header' + (platform.isElectron ? ' mac-drag' : '')}>
              <button className="iconbtn no-drag" title="Back to home" onClick={() => setRoute({ view: 'home' })}>
                <IcChevronL />
              </button>
              <AppGlyph kind={currentDoc.meta.kind} size={24} />
              <input
                className="title-input no-drag"
                value={currentDoc.meta.title}
                spellCheck={false}
                onChange={(e) => handleTitleChange(currentDoc.meta.kind, e.target.value)}
                onBlur={(e) => {
                  if (!e.target.value.trim())
                    handleTitleChange(currentDoc.meta.kind, NEW_TITLES[currentDoc.meta.kind])
                }}
              />
              <span className={'save-dot ' + saveState} title={saveState === 'saving' ? 'Saving…' : 'All changes saved locally'} />
              <span className="save-label">
                {saveState === 'saving' ? 'Saving…' : currentDoc.meta.filePath ? 'Saved to file' : 'Saved locally'}
              </span>
              <div style={{ flex: 1 }} />
              <button className="btn no-drag" onClick={handleOpenDialog} style={{ gap: 6 }}>
                <IcFolder /> Open
              </button>
              <div className="save-split no-drag">
                <button className="btn primary" onClick={() => requestSave(false)}>
                  Save
                </button>
                <MenuButton
                  label="Save a copy as…"
                  align="right"
                  trigger={
                    <svg viewBox="0 0 20 20" fill="none" width="15" height="15">
                      <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  }
                  items={[
                    { header: 'Save a copy as' },
                    {
                      label: `Anleo file (.${extFor(currentDoc.meta.kind)})`,
                      onClick: () => requestSave(true),
                    },
                    ...getExporters(currentDoc.meta.kind)
                      .filter((f) => platform.isElectron || f.ext !== 'pdf')
                      .map(
                        (f): MenuItem => ({
                          label: `${f.label} (.${f.ext})`,
                          onClick: () => handleCopyAs(f.ext),
                        }),
                      ),
                  ]}
                />
              </div>
            </header>
            <div className="editor-body">
              {currentDoc.meta.kind === 'docs' && <DocsApp {...editorProps} />}
              {currentDoc.meta.kind === 'sheets' && <SheetsApp {...editorProps} />}
              {currentDoc.meta.kind === 'slides' && <SlidesApp {...editorProps} />}
            </div>
          </div>
        )}
      </div>

      {saveToast && <div className="save-toast">{saveToast}</div>}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />

      {showSettings && (
        <Modal
          title="Settings"
          subtitle="Your documents live on this Mac. Nothing is uploaded unless you turn on AI below."
          onClose={() => setShowSettings(false)}
          width={520}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Appearance</span>
            <Select
              value={settings.theme}
              onChange={(v) => setTheme(v as ThemePref)}
              width={140}
              options={[
                { value: 'system', label: 'Match system' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </div>

          <AiSettingsFields />

          <div className="settings-section-title">Privacy</div>
          <PrivacyPanel />

          <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6, marginTop: 18 }}>
            Anleo Office · Docs, Sheets &amp; Slides
            <br />
            Free forever. No accounts, no subscription, no tracking.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <Button variant="primary" onClick={() => setShowSettings(false)}>
              Done
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
