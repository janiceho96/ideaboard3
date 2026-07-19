import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { saveImage, getImage, deleteImage } from './slideImageStore'

describe('slideImageStore', () => {
  it('saves and retrieves an image by id', async () => {
    await saveImage('tile-1', 'data:image/png;base64,abc')
    const result = await getImage('tile-1')
    expect(result).toBe('data:image/png;base64,abc')
  })

  it('returns null for an id that has not been saved', async () => {
    const result = await getImage('nonexistent-id')
    expect(result).toBeNull()
  })

  it('deletes an image so it is no longer retrievable', async () => {
    await saveImage('tile-2', 'data:image/png;base64,xyz')
    await deleteImage('tile-2')
    const result = await getImage('tile-2')
    expect(result).toBeNull()
  })
})
