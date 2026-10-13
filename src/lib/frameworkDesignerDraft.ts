import type { FrameworkLayout } from '../types'
import type { FrameworkSectionDraft } from './customFrameworks'

export interface FrameworkDesignerDraft {
  goal: string
  label: string
  purpose: string
  layout: FrameworkLayout
  sections: FrameworkSectionDraft[]
  templateId?: string
  savedTemplateId?: string
  templateRevision: number
  savedStructure: string
  selectedSourceIds: string[]
}

export function frameworkDesignerDraftKey(boardId: string, templateId?: string): string {
  return `ideaboard_framework_draft_${encodeURIComponent(JSON.stringify([boardId, templateId ?? null]))}`
}

export function readFrameworkDesignerDraft(key: string, storage: Pick<Storage, 'getItem'> = localStorage): FrameworkDesignerDraft | null {
  try {
    const raw = storage.getItem(key)
    if (!raw || raw.length > 40000) return null
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return null
    const draft = value as Record<string, unknown>
    const text = (value: unknown, limit: number) => typeof value === 'string' && value.length <= limit
    if (!text(draft.goal, 3000) || !text(draft.label, 80) || !text(draft.purpose, 600)
      || !['grid', 'flow', 'matrix', 'cycle'].includes(String(draft.layout))
      || !Array.isArray(draft.sections) || draft.sections.length > 8
      || !draft.sections.every(section => section && typeof section === 'object' && text(section.label, 70) && text(section.guidance, 300) && (section.id === undefined || text(section.id, 128)))
      || !Array.isArray(draft.selectedSourceIds) || draft.selectedSourceIds.length > 12 || !draft.selectedSourceIds.every(id => text(id, 256))
      || !Number.isSafeInteger(draft.templateRevision) || Number(draft.templateRevision) < 1
      || !text(draft.savedStructure, 12000)
      || (draft.templateId !== undefined && !text(draft.templateId, 128))
      || (draft.savedTemplateId !== undefined && !text(draft.savedTemplateId, 128))) return null
    // Pick fields explicitly: provider consent and source bodies are never recovered.
    return {
      goal: draft.goal as string, label: draft.label as string, purpose: draft.purpose as string,
      layout: draft.layout as FrameworkLayout, sections: draft.sections as FrameworkSectionDraft[],
      templateId: draft.templateId as string | undefined, savedTemplateId: draft.savedTemplateId as string | undefined,
      templateRevision: draft.templateRevision as number, savedStructure: draft.savedStructure as string,
      selectedSourceIds: [...new Set(draft.selectedSourceIds as string[])],
    }
  } catch { return null }
}

export function writeFrameworkDesignerDraft(key: string, draft: FrameworkDesignerDraft, storage: Pick<Storage, 'setItem'> = localStorage): boolean {
  try { storage.setItem(key, JSON.stringify(draft)); return true } catch { return false }
}

export function clearFrameworkDesignerDraft(key: string, storage: Pick<Storage, 'removeItem'> = localStorage): boolean {
  try { storage.removeItem(key); return true } catch { return false }
}
