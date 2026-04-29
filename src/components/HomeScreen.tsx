// src/components/HomeScreen.tsx
import { useState, useEffect } from 'react'
import type { LocalUser, Board } from '../types'
import * as db from '../lib/db'

interface Props {
  user: LocalUser
  onOpenBoard: (board: Board) => void
  onSignOut: () => void
  dark: boolean
  onToggleDark: () => void
}

export default function HomeScreen({ user, onOpenBoard, onSignOut, dark, onToggleDark }: Props) {
  const [boards, setBoards] = useState<Board[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    db.fetchBoards().then(b => { setBoards(b); setLoading(false) })
  }, [])

  const createBoard = async () => {
    if (!newName.trim()) return
    const b = await db.createBoard(newName.trim(), user.id)
    setBoards(prev => [...prev, b])
    setNewName(''); setCreating(false)
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
  }

  const bg   = dark ? '#0F0F14' : '#ECEAE3'
  const card = dark ? '#1A1A24' : '#FFFFFF'
  const bdr  = dark ? '#2A2A38' : 'rgba(0,0,0,.1)'
  const txt  = dark ? '#F0EEE8' : '#1A1A2E'
  const sub  = dark ? '#888'    : '#999'

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: "'DM Sans',sans-serif", backgroundImage: 'radial-gradient(circle,rgba(0,0,0,.1) 1px,transparent 1px)', backgroundSize: '24px 24px' }}>
      {/* Top bar */}
      <div style={{ position: 'sticky', top: 0, background: dark ? 'rgba(15,15,20,.94)' : 'rgba(248,246,240,.94)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${bdr}`, padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', gap: 12, zIndex: 50 }}>
        <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg,#6C63FF,#E040FB)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16, color: 'white' }}>I</div>
        <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16, color: txt }}>Ideaboard</span>
        <div style={{ flex: 1 }}/>
        <span style={{ fontSize: 13, color: sub }}>{user.email}</span>
        <button onClick={onToggleDark} title="Toggle dark mode"
          style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${bdr}`, background: dark ? '#25252F' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
          {dark ? '☀️' : '🌙'}
        </button>
        <button onClick={onSignOut} style={{ height: 32, padding: '0 14px', borderRadius: 8, border: `1px solid ${bdr}`, background: dark ? '#25252F' : 'white', color: sub, cursor: 'pointer', fontSize: 13, fontFamily: "'DM Sans',sans-serif" }}>Sign out</button>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 28, color: txt, marginBottom: 4 }}>Your Boards</h1>
            <p style={{ fontSize: 14, color: sub }}>{boards.length} board{boards.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setCreating(true)}
            style={{ height: 38, padding: '0 18px', borderRadius: 10, border: 'none', background: '#6C63FF', color: 'white', cursor: 'pointer', fontSize: 14, fontFamily: "'DM Sans',sans-serif", fontWeight: 500 }}>
            + New Board
          </button>
        </div>

        {/* New board input */}
        {creating && (
          <div style={{ background: card, border: `2px solid #6C63FF`, borderRadius: 14, padding: '16px 18px', marginBottom: 16, display: 'flex', gap: 10 }}>
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createBoard(); if (e.key === 'Escape') setCreating(false) }}
              placeholder="Board name…"
              style={{ flex: 1, border: `1.5px solid ${bdr}`, borderRadius: 8, padding: '8px 12px', fontSize: 14, fontFamily: "'DM Sans',sans-serif", background: dark ? '#25252F' : 'white', color: txt, outline: 'none' }}
            />
            <button onClick={createBoard} style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#6C63FF', color: 'white', cursor: 'pointer', fontSize: 13, fontFamily: "'DM Sans',sans-serif" }}>Create</button>
            <button onClick={() => setCreating(false)} style={{ height: 36, padding: '0 14px', borderRadius: 8, border: `1px solid ${bdr}`, background: 'transparent', color: sub, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {boards.map(b => (
              <div key={b.id}
                style={{ background: card, border: `1.5px solid ${bdr}`, borderRadius: 16, padding: '20px 20px 16px', cursor: 'pointer', transition: 'border-color .15s, transform .15s', position: 'relative' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#6C63FF'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = bdr; (e.currentTarget as HTMLDivElement).style.transform = 'none' }}
                onClick={() => editingId !== b.id && onOpenBoard(b)}
              >
                {/* Board preview */}
                <div style={{ height: 80, borderRadius: 10, marginBottom: 14, background: dark ? '#25252F' : '#F5F0E8', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: 8 }}>
                  {['#D4EDD8','#FFF3B0','#FFD6C2','#E8E0F5'].map((c,i) => (
                    <div key={i} style={{ background: c, borderRadius: 5, opacity: .8 }}/>
                  ))}
                </div>

                {/* Name — editable inline */}
                {editingId === b.id ? (
                  <input autoFocus value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onBlur={() => renameBoard(b.id)}
                    onKeyDown={e => { if (e.key === 'Enter') renameBoard(b.id); if (e.key === 'Escape') setEditingId(null) }}
                    onClick={e => e.stopPropagation()}
                    style={{ width: '100%', border: `1.5px solid #6C63FF`, borderRadius: 7, padding: '4px 8px', fontSize: 14, fontFamily: "'Syne',sans-serif", fontWeight: 700, background: dark ? '#25252F' : 'white', color: txt, outline: 'none', boxSizing: 'border-box' }}
                  />
                ) : (
                  <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, color: txt, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name}</div>
                )}

                <div style={{ fontSize: 11, color: sub }}>{new Date(b.created_at).toLocaleDateString()}</div>

                {/* Actions */}
                <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 4 }}>
                  <button onClick={e => { e.stopPropagation(); setEditingId(b.id); setEditName(b.name) }}
                    title="Rename" style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${bdr}`, background: dark ? '#25252F' : 'white', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✏️</button>
                  <button onClick={e => { e.stopPropagation(); removeBoard(b.id) }}
                    title="Delete" style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${bdr}`, background: dark ? '#25252F' : 'white', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
