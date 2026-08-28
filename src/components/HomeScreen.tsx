// src/components/HomeScreen.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import type { LocalUser, Board, Card, Group, BoardGroup } from '../types'
import * as db from '../lib/db'
import BoardThumbnail from './BoardThumbnail'
import TemplatePreview from './TemplatePreview'
import { BOARD_TEMPLATES, buildBoardTemplatePayload, type BoardTemplateId } from '../lib/boardTemplates'
import { FolderPlus, GripVertical, LogOut, Moon, Pencil, Plus, Sun, Trash2 } from 'lucide-react'
import { colors, fonts, radii } from '../lib/designTokens'

interface Props {
  user: LocalUser
  onOpenBoard: (board: Board) => void
  onSignOut: () => void
  dark: boolean
  onToggleDark: () => void
}

export default function HomeScreen({ user, onOpenBoard, onSignOut, dark, onToggleDark }: Props) {
  const [boards, setBoards] = useState<Board[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [boardGroups, setBoardGroups] = useState<BoardGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<BoardTemplateId | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editGroupName, setEditGroupName] = useState('')
  const [creatingBoardInGroup, setCreatingBoardInGroup] = useState<string | null>(null)
  const [newBoardInGroupName, setNewBoardInGroupName] = useState('')
  const [chipDropdown, setChipDropdown] = useState<{ boardId: string; x: number; y: number } | null>(null)
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const dragGroupId = useRef<string | null>(null)
  const dragOrderRef = useRef<string[]>([])
  const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null)
  const [allCards, setAllCards] = useState<Card[]>([])

  const loadBoards = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [b, g, bg, ac] = await Promise.all([
        db.fetchBoards(),
        db.fetchGroups(),
        db.fetchBoardGroups(),
        db.fetchAllCards(),
      ])
      setBoards(b)
      setGroups(g)
      setBoardGroups(bg)
      setAllCards(ac)
    } catch {
      setLoadError('We could not load your boards.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadBoards() }, [loadBoards])

  const createBoard = async (groupId?: string) => {
    const template = BOARD_TEMPLATES.find(t => t.id === selectedTemplateId)
    const name = newName.trim() || template?.name
    if (!name) return
    setSaving(true)
    setCreateError(null)
    let createdBoard: Board | null = null
    try {
      createdBoard = await db.createBoard(name, user.id)
      if (selectedTemplateId) {
        const seeded = buildBoardTemplatePayload({ templateId: selectedTemplateId, boardId: createdBoard.id })
        await Promise.all(seeded.cards.map(insert => db.createCard(insert)))
        await db.createGoalTags(seeded.goalTags.map(tag => ({
          board_id: createdBoard!.id,
          label: tag.label,
          bg: tag.bg,
          color: tag.color,
          x: tag.x,
          y: tag.y,
        })))
        localStorage.setItem(`ideaboard_frames_${createdBoard.id}`, JSON.stringify(seeded.frames))
        localStorage.setItem(`ideaboard_textblocks_${createdBoard.id}`, JSON.stringify(seeded.textBlocks))
        setAllCards(prev => [...prev, ...seeded.cards.map((insert, i) => ({
          ...insert,
          id: `template-preview-${createdBoard!.id}-${i}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }))])
      }
      if (groupId) {
        await db.addBoardToGroup(createdBoard.id, groupId)
        setBoardGroups(prev => [...prev, { board_id: createdBoard!.id, group_id: groupId }])
      }
      setBoards(prev => [...prev, createdBoard!])
      setNewName('')
      setSelectedTemplateId(null)
      setCreating(false)
    } catch {
      if (createdBoard) {
        await db.deleteBoard(createdBoard.id)
        localStorage.removeItem(`ideaboard_frames_${createdBoard.id}`)
        localStorage.removeItem(`ideaboard_textblocks_${createdBoard.id}`)
      }
      setCreateError('We could not create that board yet. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const renameBoard = async (id: string) => {
    if (!editName.trim()) return
    await db.updateBoard(id, editName.trim())
    setBoards(prev => prev.map(b => b.id === id ? { ...b, name: editName.trim() } : b))
    setEditingId(null)
  }

  const removeBoard = async (id: string) => {
    if (!confirm('Delete this board and all its cards? This cannot be undone.')) return
    await db.deleteBoard(id)
    setBoards(prev => prev.filter(b => b.id !== id))
    setBoardGroups(prev => prev.filter(bg => bg.board_id !== id))
  }

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return
    const g = await db.createGroup(newGroupName.trim())
    setGroups(prev => [g, ...prev.map(g2 => ({ ...g2, order: g2.order + 1 }))])
    setNewGroupName(''); setCreatingGroup(false)
  }

  const renameGroup = async (id: string) => {
    if (!editGroupName.trim()) return
    await db.updateGroup(id, editGroupName.trim())
    setGroups(prev => prev.map(g => g.id === id ? { ...g, name: editGroupName.trim() } : g))
    setEditingGroupId(null)
  }

  const removeGroup = async (id: string) => {
    const group = groups.find(g => g.id === id)
    if (!confirm(`Delete group "${group?.name}"? Boards will move to Uncategorized.`)) return
    await db.deleteGroup(id)
    setGroups(prev => prev.filter(g => g.id !== id))
    setBoardGroups(prev => prev.filter(bg => bg.group_id !== id))
  }

  const createBoardInGroup = async (groupId: string) => {
    if (!newBoardInGroupName.trim()) return
    const b = await db.createBoard(newBoardInGroupName.trim(), user.id)
    await db.addBoardToGroup(b.id, groupId)
    setBoards(prev => [...prev, b])
    setBoardGroups(prev => [...prev, { board_id: b.id, group_id: groupId }])
    setNewBoardInGroupName(''); setCreatingBoardInGroup(null)
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragGroupId.current) return
      const currentOrder = dragOrderRef.current
      const draggingIdx = currentOrder.indexOf(dragGroupId.current)
      if (draggingIdx === -1) return

      if (draggingIdx > 0) {
        const prevId = currentOrder[draggingIdx - 1]
        const prevEl = groupRefs.current[prevId]
        if (prevEl) {
          const rect = prevEl.getBoundingClientRect()
          if (e.clientY < rect.top + rect.height / 2) {
            const newOrder = [...currentOrder]
            newOrder[draggingIdx] = prevId
            newOrder[draggingIdx - 1] = dragGroupId.current
            dragOrderRef.current = newOrder
            setGroups(prev =>
              newOrder.map((id, i) => ({ ...prev.find(g => g.id === id)!, order: i }))
            )
            return
          }
        }
      }

      if (draggingIdx < currentOrder.length - 1) {
        const nextId = currentOrder[draggingIdx + 1]
        const nextEl = groupRefs.current[nextId]
        if (nextEl) {
          const rect = nextEl.getBoundingClientRect()
          if (e.clientY > rect.top + rect.height / 2) {
            const newOrder = [...currentOrder]
            newOrder[draggingIdx] = nextId
            newOrder[draggingIdx + 1] = dragGroupId.current
            dragOrderRef.current = newOrder
            setGroups(prev =>
              newOrder.map((id, i) => ({ ...prev.find(g => g.id === id)!, order: i }))
            )
          }
        }
      }
    }

    const onUp = () => {
      if (!dragGroupId.current) return
      db.reorderGroups(dragOrderRef.current)
      dragGroupId.current = null
      setDraggingGroupId(null)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const cardsForBoard = (boardId: string): Card[] =>
    allCards
      .filter(c => c.board_id === boardId)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 3)

  const bg   = dark ? colors.canvasDark : colors.canvasLight
  const bdr  = dark ? colors.borderDark : colors.borderLight
  const txt  = dark ? '#F7F7F2' : colors.ink
  const sub  = dark ? '#AAB5C9' : '#5F687B'
  const displayName = user.email.split('@')[0] || 'there'

  const assignedIds = new Set(boardGroups.map(bg => bg.board_id))
  const uncategorized = boards.filter(b => !assignedIds.has(b.id))

  const renderBoardCard = (b: Board) => (
    <div
      key={b.id}
      className="ib-board-card"
      role="button"
      tabIndex={0}
      aria-label={`Open board ${b.name}`}
      onClick={() => editingId !== b.id && onOpenBoard(b)}
      onKeyDown={e => {
        if ((e.key === 'Enter' || e.key === ' ') && editingId !== b.id) {
          e.preventDefault()
          onOpenBoard(b)
        }
      }}
    >
      <BoardThumbnail cards={cardsForBoard(b.id)} dark={dark} />
      {editingId === b.id ? (
        <input
          autoFocus
          value={editName}
          onChange={e => setEditName(e.target.value)}
          onBlur={() => renameBoard(b.id)}
          onKeyDown={e => { if (e.key === 'Enter') renameBoard(b.id); if (e.key === 'Escape') setEditingId(null) }}
          onClick={e => e.stopPropagation()}
          className="ib-input"
          style={{ fontFamily: fonts.display, fontWeight: 700 }}
        />
      ) : (
        <div className="ib-board-card-title">{b.name}</div>
      )}
      <div className="ib-board-card-date">{new Date(b.created_at).toLocaleDateString()}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 9 }} onClick={e => e.stopPropagation()}>
        {groups
          .filter(g => boardGroups.some(bg => bg.board_id === b.id && bg.group_id === g.id))
          .map(g => (
            <span key={g.id}
              onClick={e => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setChipDropdown({ boardId: b.id, x: r.left, y: r.bottom + 4 }) }}
              style={{ fontSize: 10, padding: '3px 7px', borderRadius: radii.control, background: dark ? '#273654' : '#EEEBFF', color: dark ? '#D6D0FF' : colors.markerPurple, cursor: 'pointer', border: `1px solid ${dark ? colors.borderDark : '#D8D2FF'}`, fontFamily: fonts.ui }}
            >{g.name}</span>
          ))
        }
        <button
          type="button"
          aria-label={`Add ${b.name} to a group`}
          title="Add to a group"
          onClick={e => { e.stopPropagation(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setChipDropdown({ boardId: b.id, x: r.left, y: r.bottom + 4 }) }}
          style={{ width: 24, height: 22, display: 'grid', placeItems: 'center', borderRadius: radii.control, background: 'transparent', color: sub, cursor: 'pointer', border: `1px dashed ${bdr}` }}
        ><Plus size={13} /></button>
      </div>
      <div className="ib-board-card-actions">
        <button className="ib-icon-button" onClick={e => { e.stopPropagation(); setEditingId(b.id); setEditName(b.name) }} aria-label={`Rename ${b.name}`} title="Rename">
          <Pencil size={13} />
        </button>
        <button className="ib-icon-button" onClick={e => { e.stopPropagation(); removeBoard(b.id) }} aria-label={`Delete ${b.name}`} title="Delete">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )

  const renderGrid = (sectionBoards: Board[]) => (
    sectionBoards.length === 0
      ? <p className="ib-subtle" style={{ fontStyle: 'italic', marginBottom: 8 }}>No boards in this group</p>
      : <div className="ib-board-grid">
          {sectionBoards.map(renderBoardCard)}
        </div>
  )

  return (
    <div className="ib-page" data-theme={dark ? 'dark' : 'light'} style={{ backgroundColor: bg, color: txt }}>
      <div className="ib-topbar">
        <div className="ib-logo" aria-hidden="true">I</div>
        <span className="ib-brand-name">Ideaboard</span>
        <div className="ib-topbar-spacer" />
        <span className="ib-subtle" style={{ fontSize: 12 }}>{user.email}</span>
        <button className="ib-icon-button" onClick={onToggleDark} aria-label={dark ? 'Use light mode' : 'Use dark mode'} title={dark ? 'Use light mode' : 'Use dark mode'}>
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button className="ib-action" onClick={onSignOut} title="Sign out"><LogOut size={15} /> Sign out</button>
      </div>

      <main className="ib-content">
        <div className="ib-welcome">
          <div>
            <h1>Good to see you, {displayName}.</h1>
            <p>Pick up an idea or start with a fresh board.</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button className="ib-action" onClick={() => setCreatingGroup(true)} title="Create a group"><FolderPlus size={15} /> New group</button>
            <button className="ib-action ib-action-primary" onClick={() => { setCreating(true); setCreateError(null) }} title="Create a board"><Plus size={16} /> New board</button>
          </div>
        </div>

        {creating && (
          <section className="ib-new-board-panel" aria-labelledby="new-board-heading">
            <div className="ib-section-header" style={{ marginBottom: 6 }}>
              <div>
                <h2 id="new-board-heading">Start with a shape</h2>
                <p className="ib-subtle" style={{ marginTop: 4 }}>Choose a shape to get started, then make it yours.</p>
              </div>
              <button className="ib-icon-button" type="button" onClick={() => { setCreating(false); setSelectedTemplateId(null); setCreateError(null) }} aria-label="Close new board form" title="Close"><span aria-hidden="true">×</span></button>
            </div>
            <div className="ib-form-row">
              <input className="ib-input" autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createBoard(); if (e.key === 'Escape') { setCreating(false); setSelectedTemplateId(null) } }}
                placeholder={selectedTemplateId ? 'Name your board' : 'Board name'}
                aria-label="Board name"
              />
              <button className="ib-action ib-action-primary" onClick={() => createBoard()} disabled={saving || (!newName.trim() && !selectedTemplateId)}><Plus size={15} /> {saving ? 'Creating...' : 'Create board'}</button>
            </div>
            {createError && <div className="ib-error-state" role="alert" style={{ margin: '14px 0 0', padding: '10px 12px', boxShadow: 'none' }}><strong>{createError}</strong></div>}
            <div className="ib-template-grid">
              {BOARD_TEMPLATES.map(template => (
                <TemplatePreview
                  key={template.id}
                  templateId={template.id}
                  name={template.name}
                  description={template.description}
                  selected={selectedTemplateId === template.id}
                  dark={dark}
                  onSelect={() => { setSelectedTemplateId(template.id); if (!newName.trim()) setNewName(template.name) }}
                />
              ))}
            </div>
          </section>
        )}

        {creatingGroup && (
          <section className="ib-group-panel" aria-labelledby="new-group-heading">
            <div className="ib-section-header" style={{ marginBottom: 10 }}>
              <h2 id="new-group-heading">Create a group</h2>
              <button className="ib-icon-button" type="button" onClick={() => setCreatingGroup(false)} aria-label="Close new group form" title="Close"><span aria-hidden="true">×</span></button>
            </div>
            <div className="ib-form-row">
            <input className="ib-input" autoFocus value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateGroup(); if (e.key === 'Escape') setCreatingGroup(false) }}
              placeholder="Group name"
              aria-label="Group name"
            />
            <button className="ib-action ib-action-primary" onClick={handleCreateGroup}><Plus size={15} /> Create group</button>
            </div>
          </section>
        )}

        {loadError ? (
          <div className="ib-error-state" role="alert">
            <strong>{loadError}</strong>
            <button className="ib-action" onClick={() => void loadBoards()}>Try again</button>
          </div>
        ) : loading ? (
          <div className="ib-empty-state" role="status" aria-live="polite"><strong>Loading your boards...</strong><p>Getting your workspace ready.</p></div>
        ) : boards.length === 0 && !creating ? (
          <div className="ib-empty-state">
            <strong>There is room for a good idea here.</strong>
            <p>Start with a blank board or choose a shape that fits the work.</p>
            <button className="ib-action ib-action-primary" onClick={() => setCreating(true)}><Plus size={15} /> Start a board</button>
          </div>
        ) : (
          <>
            {groups.map(group => {
              const ids = boardGroups.filter(bg => bg.group_id === group.id).map(bg => bg.board_id)
              const groupBoards = boards.filter(b => ids.includes(b.id))
              return (
                <div
                  key={group.id}
                  ref={el => { groupRefs.current[group.id] = el }}
                  style={{
                    marginBottom: 36,
                    opacity: draggingGroupId === group.id ? 0.5 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <button
                      type="button"
                      onMouseDown={e => {
                        e.preventDefault()
                        dragGroupId.current = group.id
                        dragOrderRef.current = groups.map(g => g.id)
                        setDraggingGroupId(group.id)
                      }}
                      title="Drag to reorder"
                      aria-label={`Reorder ${group.name}`}
                      style={{ display: 'grid', placeItems: 'center', width: 24, height: 24, border: 0, background: 'transparent', color: sub, cursor: 'grab', padding: 0 }}
                    ><GripVertical size={15} /></button>
                    {editingGroupId === group.id ? (
                      <input autoFocus value={editGroupName}
                        onChange={e => setEditGroupName(e.target.value)}
                        onBlur={() => renameGroup(group.id)}
                        onKeyDown={e => { if (e.key === 'Enter') renameGroup(group.id); if (e.key === 'Escape') setEditingGroupId(null) }}
                        style={{ border: `1.5px solid #6C63FF`, borderRadius: 6, padding: '3px 8px', fontSize: 15, fontFamily: "'Syne',sans-serif", fontWeight: 700, background: dark ? '#162845' : 'white', color: txt, outline: 'none' }}
                      />
                    ) : (
                      <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 16, color: txt }}>{group.name}</span>
                    )}
                    <button className="ib-icon-button" onClick={() => { setEditingGroupId(group.id); setEditGroupName(group.name) }}
                      title="Rename group" aria-label={`Rename ${group.name}`} style={{ width: 26, height: 26 }}><Pencil size={12} /></button>
                    <button className="ib-icon-button" onClick={() => removeGroup(group.id)}
                      title="Delete group" aria-label={`Delete ${group.name}`} style={{ width: 26, height: 26 }}><Trash2 size={12} /></button>
                    <button className="ib-action" onClick={() => { setCreatingBoardInGroup(group.id); setNewBoardInGroupName('') }}
                      title={`Create a board in ${group.name}`} style={{ marginLeft: 'auto', minHeight: 30, padding: '0 10px', fontSize: 11 }}>
                      <Plus size={13} /> New board
                    </button>
                  </div>
                  <div style={{ height: 1, background: bdr, marginBottom: 16 }} />
                  {creatingBoardInGroup === group.id && (
                    <div className="ib-group-panel" style={{ padding: 14 }}>
                      <div className="ib-form-row">
                      <input className="ib-input" autoFocus value={newBoardInGroupName} onChange={e => setNewBoardInGroupName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') createBoardInGroup(group.id); if (e.key === 'Escape') setCreatingBoardInGroup(null) }}
                        placeholder="Board name"
                        aria-label="Board name"
                      />
                      <button className="ib-action ib-action-primary" onClick={() => createBoardInGroup(group.id)}><Plus size={14} /> Create</button>
                      <button className="ib-action" onClick={() => setCreatingBoardInGroup(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                  {renderGrid(groupBoards)}
                </div>
              )
            })}
            {uncategorized.length > 0 && (
              <div style={{ marginBottom: 36 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16, color: sub }}>Uncategorized</span>
                </div>
                <div style={{ height: 1, background: bdr, marginBottom: 16 }} />
                {renderGrid(uncategorized)}
              </div>
            )}
          </>
        )}
      </main>

      {/* Group-assignment dropdown */}
      {chipDropdown && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={() => setChipDropdown(null)} />
          <div style={{
            position: 'fixed',
            left: Math.min(chipDropdown.x, window.innerWidth - 200),
            top: Math.min(chipDropdown.y, window.innerHeight - 40 - groups.length * 36),
            zIndex: 201,
            background: dark ? '#152336' : 'white',
            border: `1px solid ${bdr}`,
            borderRadius: 10,
            padding: '8px 0',
            boxShadow: '0 8px 24px rgba(0,0,0,.18)',
            minWidth: 180,
          }}>
            {groups.length === 0 ? (
              <div style={{ padding: '8px 16px', fontSize: 13, color: sub }}>No groups yet: create one first</div>
            ) : groups.map(g => {
              const checked = boardGroups.some(bg => bg.board_id === chipDropdown.boardId && bg.group_id === g.id)
              return (
                <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', cursor: 'pointer' }}
                  onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={checked}
                    onChange={async () => {
                      if (checked) {
                        await db.removeBoardFromGroup(chipDropdown.boardId, g.id)
                        setBoardGroups(prev => prev.filter(bg => !(bg.board_id === chipDropdown.boardId && bg.group_id === g.id)))
                      } else {
                        await db.addBoardToGroup(chipDropdown.boardId, g.id)
                        setBoardGroups(prev => [...prev, { board_id: chipDropdown.boardId, group_id: g.id }])
                      }
                    }}
                  />
                  <span style={{ fontSize: 13, color: txt, fontFamily: "'DM Sans',sans-serif" }}>{g.name}</span>
                </label>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
