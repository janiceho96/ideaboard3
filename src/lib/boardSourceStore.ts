export type BoardSourceKind = 'markdown' | 'text' | 'pdf-page' | 'image'

export interface BoardSource {
  id: string
  board_id: string
  kind: BoardSourceKind
  title: string
  text: string
  mime_type: string
  slide_id?: string
  page_number?: number
  total_pages?: number
  created_at: string
}

const DB_NAME = 'ideaboard_db'
const STORE_NAME = 'board_sources'
const DB_VERSION = 2
let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('slide_images')) request.result.createObjectStore('slide_images')
        if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => { dbPromise = null; reject(request.error) }
      request.onblocked = () => { dbPromise = null; reject(new Error('IndexedDB upgrade blocked by another tab')) }
    })
  }
  return dbPromise
}

export async function saveBoardSources(sources: BoardSource[]): Promise<void> {
  if (!sources.length) return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    for (const source of sources) store.put(source)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('Source save was interrupted'))
  })
}

export async function listBoardSources(boardId: string): Promise<BoardSource[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).getAll()
    tx.oncomplete = () => resolve((request.result as BoardSource[]).filter(source => source.board_id === boardId))
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('Source read was interrupted'))
  })
}

export async function exportAllBoardSources(): Promise<BoardSource[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).getAll()
    tx.oncomplete = () => resolve(request.result as BoardSource[])
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('Source export was interrupted'))
  })
}

export async function deleteBoardSources(ids: string[]): Promise<void> {
  if (!ids.length) return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    for (const id of ids) store.delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('Source removal was interrupted'))
  })
}

export async function deleteBoardSourcesForBoard(boardId: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.getAll()
    request.onsuccess = () => {
      for (const source of request.result as BoardSource[]) if (source.board_id === boardId) store.delete(source.id)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('Source cleanup was interrupted'))
  })
}
