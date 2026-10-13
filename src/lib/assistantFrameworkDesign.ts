import type { CustomFrameworkTemplate } from '../types'
import type { AssistantSource } from './assistantPlan'
import { validateCustomFrameworkTemplate } from './customFrameworks'
import { clearFrameworkDesignerDraft, frameworkDesignerDraftKey } from './frameworkDesignerDraft'

export interface AssistantFrameworkDesign {
  template: CustomFrameworkTemplate
  goal: string
  sourceIds: string[]
}
export const FRAMEWORK_DESIGN_CHANGED = 'ideaboard:framework-design-changed'
const key = (boardId: string) => `ideaboard_assistant_framework_design_${encodeURIComponent(boardId)}`

export function readAssistantFrameworkDesign(boardId: string, storage: Pick<Storage, 'getItem'> = localStorage): AssistantFrameworkDesign | null {
  try {
    const raw = storage.getItem(key(boardId))
    if (!raw || raw.length > 20000) return null
    const value = JSON.parse(raw)
    const template = validateCustomFrameworkTemplate(value?.template)
    if (!template || typeof value.goal !== 'string' || !value.goal.trim() || value.goal.length > 3000
      || !Array.isArray(value.sourceIds) || value.sourceIds.length > 12 || !value.sourceIds.every((id: unknown) => typeof id === 'string' && /^[a-zA-Z0-9_.:-]{1,128}$/.test(id))) return null
    return { template, goal: value.goal, sourceIds: [...new Set<string>(value.sourceIds)] }
  } catch { return null }
}

export function saveAssistantFrameworkDesign(boardId: string, design: AssistantFrameworkDesign, storage: Pick<Storage, 'setItem' | 'getItem'> = localStorage): void {
  const raw = JSON.stringify(design)
  storage.setItem(key(boardId), raw)
  if (storage.getItem(key(boardId)) !== raw || !readAssistantFrameworkDesign(boardId, storage)) throw new Error('The framework draft could not be saved for recovery. Save it in the designer before closing the app.')
}

export function discardAssistantFrameworkDesign(boardId: string, templateId: string, storage: Pick<Storage, 'getItem' | 'removeItem'> = localStorage): void {
  const current = readAssistantFrameworkDesign(boardId, storage)
  if (current && current.template.id !== templateId) throw new Error('A newer framework draft is waiting for review. Reopen it before discarding.')
  if (!clearFrameworkDesignerDraft(frameworkDesignerDraftKey(boardId, templateId), storage)) throw new Error('Could not remove the local framework draft.')
  storage.removeItem(key(boardId))
}

export function assertFrameworkDesignSourcesCurrent(boardId: string, selected: AssistantSource[], current: AssistantSource[]): void {
  const ids = new Set<string>()
  for (const source of selected) {
    const latest = current.find(item => item.id === source.id)
    if (source.board_id !== boardId || ids.has(source.id) || !latest || latest.board_id !== boardId || latest.body !== source.body || latest.title !== source.title) {
      throw new Error('The selected material changed. Review your source selection and try again.')
    }
    if (!source.body.trim()) throw new Error(`Extract text from “${source.source_label ?? source.title}” before designing a custom framework. The designer uses text only.`)
    ids.add(source.id)
  }
}
