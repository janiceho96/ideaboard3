// src/components/HomeScreen.tsx
import { useState, useEffect, useRef } from 'react'
import type { LocalUser, Board, Card, Group, BoardGroup } from '../types'
import * as db from '../lib/db'
import BoardThumbnail from './BoardThumbnail'
import { BOARD_TEMPLATES, buildBoardTemplatePayload, type BoardTemplateId } from '../lib/boardTemplates'

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

  useEffect(() => {
    Promise.all([db.fetchBoards(), db.fetchGroups(), db.fetchBoardGroups(), db.fetchAllCards()]).then(
      ([b, g, bg, ac]) => { setBoards(b); setGroups(g); setBoardGroups(bg); setAllCards(ac); setLoading(false) }
    )
  }, [])

  const createBoard = async (groupId?: string) => {
    const template = BOARD_TEMPLATES.find(t => t.id === selectedTemplateId)
    const name = newName.trim() || template?.name
    if (!name) return
    const b = await db.createBoard(name, user.id)
    if (selectedTemplateId) {
      const seeded = buildBoardTemplatePayload({ templateId: selectedTemplateId, boardId: b.id })
      await Promise.all(seeded.cards.map(insert => db.createCard(insert)))
      await db.createGoalTags(seeded.goalTags.map(tag => ({
        board_id: b.id,
        label: tag.label,
        bg: tag.bg,
        color: tag.color,
        x: tag.x,
        y: tag.y,
      })))
      localStorage.setItem(`ideaboard_frames_${b.id}`, JSON.stringify(seeded.frames))
      localStorage.setItem(`ideaboard_textblocks_${b.id}`, JSON.stringify(seeded.textBlocks))
      setAllCards(prev => [...prev, ...seeded.cards.map((insert, i) => ({
        ...insert,
        id: `template-preview-${b.id}-${i}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))])
    }
    if (groupId) {
      await db.addBoardToGroup(b.id, groupId)
      setBoardGroups(prev => [...prev, { board_id: b.id, group_id: groupId }])
    }
    setBoards(prev => [...prev, b])
    setNewName(''); setSelectedTemplateId(null); setCreating(false)
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

  const bg   = dark ? '#0D1B2E' : '#ECEAE3'
  const card = dark ? '#152336' : '#FFFFFF'
  const bdr  = dark ? '#1E3451' : 'rgba(0,0,0,.1)'
  const txt  = dark ? '#F0EEE8' : '#152336'
  const sub  = dark ? '#888'    : '#999'

  const assignedIds = new Set(boardGroups.map(bg => bg.board_id))
  const uncategorized = boards.filter(b => !assignedIds.has(b.id))

  const renderBoardCard = (b: Board) => (
    <div key={b.id}
      style={{ background: card, border: `1.5px solid ${bdr}`, borderRadius: 16, padding: '20px 20px 16px', cursor: 'pointer', transition: 'border-color .15s, transform .15s', position: 'relative' }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#6C63FF'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = bdr; (e.currentTarget as HTMLDivElement).style.transform = 'none' }}
      onClick={() => editingId !== b.id && onOpenBoard(b)}
    >
      <BoardThumbnail cards={cardsForBoard(b.id)} dark={dark} />
      {editingId === b.id ? (
        <input autoFocus value={editName}
          onChange={e => setEditName(e.target.value)}
          onBlur={() => renameBoard(b.id)}
          onKeyDown={e => { if (e.key === 'Enter') renameBoard(b.id); if (e.key === 'Escape') setEditingId(null) }}
          onClick={e => e.stopPropagation()}
          style={{ width: '100%', border: `1.5px solid #6C63FF`, borderRadius: 7, padding: '4px 8px', fontSize: 14, fontFamily: "'Syne',sans-serif", fontWeight: 700, background: dark ? '#162845' : 'white', color: txt, outline: 'none', boxSizing: 'border-box' }}
        />
      ) : (
        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, color: txt, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name}</div>
      )}
      <div style={{ fontSize: 11, color: sub, marginBottom: 8 }}>{new Date(b.created_at).toLocaleDateString()}</div>
      {/* Group chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }} onClick={e => e.stopPropagation()}>
        {groups
          .filter(g => boardGroups.some(bg => bg.board_id === b.id && bg.group_id === g.id))
          .map(g => (
            <span key={g.id}
              onClick={e => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setChipDropdown({ boardId: b.id, x: r.left, y: r.bottom + 4 }) }}
              style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: dark ? '#2A2A40' : '#EEE8FF', color: '#6C63FF', cursor: 'pointer', border: '1px solid #6C63FF22', fontFamily: "'DM Sans',sans-serif" }}
            >{g.name}</span>
          ))
        }
        <span
          onClick={e => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setChipDropdown({ boardId: b.id, x: r.left, y: r.bottom + 4 }) }}
          style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'transparent', color: sub, cursor: 'pointer', border: `1px dashed ${bdr}`, fontFamily: "'DM Sans',sans-serif" }}
        >+</span>
      </div>
      <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 4 }}>
        <button onClick={e => { e.stopPropagation(); setEditingId(b.id); setEditName(b.name) }}
          title="Rename" style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${bdr}`, background: dark ? '#162845' : 'white', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✏️</button>
        <button onClick={e => { e.stopPropagation(); removeBoard(b.id) }}
          title="Delete" style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${bdr}`, background: dark ? '#162845' : 'white', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🗑️</button>
      </div>
    </div>
  )

  const renderGrid = (sectionBoards: Board[]) => (
    sectionBoards.length === 0
      ? <p style={{ fontSize: 13, color: sub, fontStyle: 'italic', marginBottom: 8 }}>No boards in this group</p>
      : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {sectionBoards.map(renderBoardCard)}
        </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: "'DM Sans',sans-serif", backgroundImage: 'radial-gradient(circle,rgba(0,0,0,.1) 1px,transparent 1px)', backgroundSize: '24px 24px' }}>
      {/* Top bar */}
      <div style={{ position: 'sticky', top: 0, background: dark ? 'rgba(15,15,20,.94)' : 'rgba(248,246,240,.94)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${bdr}`, padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', gap: 12, zIndex: 50 }}>
        <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg,#6C63FF,#E040FB)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16, color: 'white' }}>I</div>
        <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16, color: txt }}>Ideaboard</span>
        <div style={{ flex: 1 }}/>
        <span style={{ fontSize: 13, color: sub }}>{user.email}</span>
        <button onClick={onToggleDark} title="Toggle dark mode"
          style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${bdr}`, background: dark ? '#162845' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
          {dark ? '☀️' : '🌙'}
        </button>
        <button onClick={onSignOut} style={{ height: 32, padding: '0 14px', borderRadius: 8, border: `1px solid ${bdr}`, background: dark ? '#162845' : 'white', color: sub, cursor: 'pointer', fontSize: 13, fontFamily: "'DM Sans',sans-serif" }}>Sign out</button>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 28, color: txt, marginBottom: 4 }}>Your Boards</h1>
            <p style={{ fontSize: 14, color: sub }}>{boards.length} board{boards.length !== 1 ? 's' : ''}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setCreatingGroup(true)}
              style={{ height: 38, padding: '0 18px', borderRadius: 10, border: `1.5px solid #6C63FF`, background: 'transparent', color: '#6C63FF', cursor: 'pointer', fontSize: 14, fontFamily: "'DM Sans',sans-serif", fontWeight: 500 }}>
              + New Group
            </button>
            <button onClick={() => setCreating(true)}
              style={{ height: 38, padding: '0 18px', borderRadius: 10, border: 'none', background: '#6C63FF', color: 'white', cursor: 'pointer', fontSize: 14, fontFamily: "'DM Sans',sans-serif", fontWeight: 500 }}>
              + New Board
            </button>
          </div>
        </div>

        {creating && (
          <div style={{ background: card, border: `2px solid #6C63FF`, borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createBoard(); if (e.key === 'Escape') { setCreating(false); setSelectedTemplateId(null) } }}
                placeholder={selectedTemplateId ? 'Rename template board…' : 'Board name…'}
                style={{ flex: 1, border: `1.5px solid ${bdr}`, borderRadius: 8, padding: '8px 12px', fontSize: 14, fontFamily: "'DM Sans',sans-serif", background: dark ? '#162845' : 'white', color: txt, outline: 'none' }}
              />
              <button onClick={() => createBoard()} style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#6C63FF', color: 'white', cursor: 'pointer', fontSize: 13, fontFamily: "'DM Sans',sans-serif" }}>Create</button>
              <button onClick={() => { setCreating(false); setSelectedTemplateId(null) }} style={{ height: 36, padding: '0 14px', borderRadius: 8, border: `1px solid ${bdr}`, background: 'transparent', color: sub, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
            </div>
            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
              {BOARD_TEMPLATES.map(template => (
                <button
                  key={template.id}
                  onClick={() => { setSelectedTemplateId(template.id); if (!newName.trim()) setNewName(template.name) }}
                  style={{
                    textAlign: 'left',
                    border: `1.5px solid ${selectedTemplateId === template.id ? '#6C63FF' : bdr}`,
                    background: selectedTemplateId === template.id ? (dark ? '#1B2B4A' : '#F0EDFF') : (dark ? '#162845' : 'white'),
                    color: txt,
                    borderRadius: 10,
                    padding: '11px 12px',
                    cursor: 'pointer',
                    fontFamily: "'DM Sans',sans-serif",
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 3 }}>{template.name}</div>
                  <div style={{ fontSize: 11, color: sub, lineHeight: 1.35 }}>{template.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {creatingGroup && (
          <div style={{ background: card, border: `2px solid #6C63FF`, borderRadius: 14, padding: '16px 18px', marginBottom: 16, display: 'flex', gap: 10 }}>
            <input autoFocus value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateGroup(); if (e.key === 'Escape') setCreatingGroup(false) }}
              placeholder="Group name…"
              style={{ flex: 1, border: `1.5px solid ${bdr}`, borderRadius: 8, padding: '8px 12px', fontSize: 14, fontFamily: "'DM Sans',sans-serif", background: dark ? '#162845' : 'white', color: txt, outline: 'none' }}
            />
            <button onClick={handleCreateGroup} style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#6C63FF', color: 'white', cursor: 'pointer', fontSize: 13, fontFamily: "'DM Sans',sans-serif" }}>Create</button>
            <button onClick={() => setCreatingGroup(false)} style={{ height: 36, padding: '0 14px', borderRadius: 8, border: `1px solid ${bdr}`, background: 'transparent', color: sub, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: sub, fontSize: 14 }}>Loading boards…</div>
        ) : boards.length === 0 && !creating ? (
          <div style={{ textAlign: 'center', padding: 80, color: sub }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🗂️</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: txt, marginBottom: 8 }}>No boards yet</div>
            <div style={{ fontSize: 14 }}>Click "New Board" to get started</div>
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
                    <span
                      onMouseDown={e => {
                        e.preventDefault()
                        dragGroupId.current = group.id
                        dragOrderRef.current = groups.map(g => g.id)
                        setDraggingGroupId(group.id)
                      }}
                      title="Drag to reorder"
                      style={{ cursor: 'grab', fontSize: 16, color: sub, userSelect: 'none', paddingRight: 4 }}
                    >⠿</span>
                    {editingGroupId === group.id ? (
                      <input autoFocus value={editGroupName}
                        onChange={e => setEditGroupName(e.target.value)}
                        onBlur={() => renameGroup(group.id)}
                        onKeyDown={e => { if (e.key === 'Enter') renameGroup(group.id); if (e.key === 'Escape') setEditingGroupId(null) }}
                        style={{ border: `1.5px solid #6C63FF`, borderRadius: 6, padding: '3px 8px', fontSize: 15, fontFamily: "'Syne',sans-serif", fontWeight: 700, background: dark ? '#162845' : 'white', color: txt, outline: 'none' }}
                      />
                    ) : (
                      <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16, color: txt }}>{group.name}</span>
                    )}
                    <button onClick={() => { setEditingGroupId(group.id); setEditGroupName(group.name) }}
                      title="Rename group" style={{ width: 24, height: 24, borderRadius: 5, border: `1px solid ${bdr}`, background: dark ? '#162845' : 'white', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✏️</button>
                    <button onClick={() => removeGroup(group.id)}
                      title="Delete group" style={{ width: 24, height: 24, borderRadius: 5, border: `1px solid ${bdr}`, background: dark ? '#162845' : 'white', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🗑️</button>
                    <button onClick={() => { setCreatingBoardInGroup(group.id); setNewBoardInGroupName('') }}
                      style={{ marginLeft: 'auto', height: 28, padding: '0 12px', borderRadius: 7, border: `1px solid ${bdr}`, background: 'transparent', color: sub, cursor: 'pointer', fontSize: 12, fontFamily: "'DM Sans',sans-serif" }}>
                      + New Board
                    </button>
                  </div>
                  <div style={{ height: 1, background: bdr, marginBottom: 16 }} />
                  {creatingBoardInGroup === group.id && (
                    <div style={{ background: card, border: `2px solid #6C63FF`, borderRadius: 14, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10 }}>
                      <input autoFocus value={newBoardInGroupName} onChange={e => setNewBoardInGroupName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') createBoardInGroup(group.id); if (e.key === 'Escape') setCreatingBoardInGroup(null) }}
                        placeholder="Board name…"
                        style={{ flex: 1, border: `1.5px solid ${bdr}`, borderRadius: 8, padding: '7px 12px', fontSize: 14, fontFamily: "'DM Sans',sans-serif", background: dark ? '#162845' : 'white', color: txt, outline: 'none' }}
                      />
                      <button onClick={() => createBoardInGroup(group.id)} style={{ height: 34, padding: '0 14px', borderRadius: 8, border: 'none', background: '#6C63FF', color: 'white', cursor: 'pointer', fontSize: 13 }}>Create</button>
                      <button onClick={() => setCreatingBoardInGroup(null)} style={{ height: 34, padding: '0 12px', borderRadius: 8, border: `1px solid ${bdr}`, background: 'transparent', color: sub, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
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
      </div>

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
              <div style={{ padding: '8px 16px', fontSize: 13, color: sub }}>No groups yet — create one first</div>
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
