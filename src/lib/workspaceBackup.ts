import { exportAllImages, saveImages } from './slideImageStore'
import { exportAllBoardSources, saveBoardSources, type BoardSource } from './boardSourceStore'

const BACKUP_SCHEMA = 'ideaboard.workspace'
const BACKUP_VERSION = 2
const STORAGE_PREFIX = 'ideaboard_'

export interface WorkspaceBackup {
  schema: typeof BACKUP_SCHEMA
  version: typeof BACKUP_VERSION
  exportedAt: string
  storage: Record<string, string>
  slideImages: Record<string, string>
  sources: BoardSource[]
}

export async function createWorkspaceBackup(
  storage: Storage = window.localStorage,
  readImages: () => Promise<Record<string, string>> = exportAllImages,
  readSources: () => Promise<BoardSource[]> = () => typeof indexedDB === 'undefined' ? Promise.resolve([]) : exportAllBoardSources(),
): Promise<WorkspaceBackup> {
  const values: Record<string, string> = {}
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key?.startsWith(STORAGE_PREFIX)) {
      const value = storage.getItem(key)
      if (value !== null) values[key] = value
    }
  }

  return {
    schema: BACKUP_SCHEMA,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    storage: values,
    slideImages: await readImages(),
    sources: await readSources(),
  }
}

export function parseWorkspaceBackup(raw: string): WorkspaceBackup {
  const data: unknown = JSON.parse(raw)
  if (!isRecord(data) || data.schema !== BACKUP_SCHEMA || (data.version !== 1 && data.version !== BACKUP_VERSION)) {
    throw new Error('This file is not a supported Ideaboard workspace backup.')
  }
  if (!isRecord(data.storage) || !isRecord(data.slideImages)) {
    throw new Error('The workspace backup is incomplete or damaged.')
  }

  const storage = Object.entries(data.storage).reduce<Record<string, string>>((entries, [key, value]) => {
    if (!key.startsWith(STORAGE_PREFIX) || typeof value !== 'string') {
      throw new Error('The workspace backup contains invalid saved data.')
    }
    entries[key] = value
    return entries
  }, {})
  const slideImages = Object.entries(data.slideImages).reduce<Record<string, string>>((images, [key, value]) => {
    if (typeof value !== 'string' || !value.startsWith('data:image/')) {
      throw new Error('The workspace backup contains an invalid slide image.')
    }
    images[key] = value
    return images
  }, {})
  const sources = Array.isArray(data.sources) ? data.sources.flatMap((value): BoardSource[] => {
    if (!isRecord(value) || typeof value.id !== 'string' || typeof value.board_id !== 'string' || typeof value.title !== 'string' || typeof value.text !== 'string' || value.text.length > 200_000 || !['markdown', 'text', 'pdf-page', 'image'].includes(String(value.kind))) {
      throw new Error('The workspace backup contains an invalid board source.')
    }
    return [value as unknown as BoardSource]
  }) : []

  return {
    schema: BACKUP_SCHEMA,
    version: BACKUP_VERSION,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '',
    storage,
    slideImages,
    sources,
  }
}

export async function restoreWorkspaceBackup(
  raw: string,
  storage: Storage = window.localStorage,
  writeImages: (images: Record<string, string>) => Promise<void> = saveImages,
  writeSources: (sources: BoardSource[]) => Promise<void> = saveBoardSources,
): Promise<{ boards: number; slideImages: number; sources: number }> {
  const backup = parseWorkspaceBackup(raw)
  const previousValues = new Map<string, string | null>()

  await writeImages(backup.slideImages)
  await writeSources(backup.sources)
  try {
    for (const [key, incoming] of Object.entries(backup.storage)) {
      previousValues.set(key, storage.getItem(key))
      storage.setItem(key, mergeStoredValue(storage.getItem(key), incoming))
    }
  } catch (error) {
    for (const [key, previous] of previousValues) {
      if (previous === null) storage.removeItem(key)
      else storage.setItem(key, previous)
    }
    throw error
  }

  const boards = JSON.parse(backup.storage['ideaboard_boards'] ?? '[]') as unknown
  return {
    boards: Array.isArray(boards) ? boards.length : 0,
    slideImages: Object.keys(backup.slideImages).length,
    sources: backup.sources.length,
  }
}

function mergeStoredValue(currentRaw: string | null, incomingRaw: string): string {
  if (currentRaw === null) return incomingRaw
  try {
    const current: unknown = JSON.parse(currentRaw)
    const incoming: unknown = JSON.parse(incomingRaw)
    if (isRecordArray(current) && isRecordArray(incoming) && [...current, ...incoming].every(item => typeof item.id === 'string')) {
      const merged = new Map(current.map(item => [item.id as string, item]))
      for (const item of incoming) merged.set(item.id as string, { ...merged.get(item.id as string), ...item })
      return JSON.stringify([...merged.values()])
    }
  } catch {
    return incomingRaw
  }
  return incomingRaw
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRecordArray(value: unknown): value is Array<Record<string, unknown>> {
  return Array.isArray(value) && value.every(isRecord)
}
