import type { BoardTemplateId } from '../lib/boardTemplates'

interface TemplatePreviewProps {
  templateId: BoardTemplateId
  name: string
  description: string
  selected: boolean
  dark: boolean
  onSelect: () => void
}

const layoutByTemplate: Record<BoardTemplateId, string> = {
  'weekly-plan': 'lanes',
  'project-brainstorm': 'cluster',
  'content-calendar': 'calendar',
  'decision-matrix': 'matrix',
}

export default function TemplatePreview({ templateId, name, description, selected, dark, onSelect }: TemplatePreviewProps) {
  const layout = layoutByTemplate[templateId]

  return (
    <button
      type="button"
      className={`ib-template-button${dark ? ' ib-template-button-dark' : ''}`}
      aria-pressed={selected}
      aria-label={`Start with ${name}: ${description}`}
      title={description}
      onClick={onSelect}
    >
      <span className={`ib-template-preview ib-template-preview--${layout}`} aria-hidden="true">
        <i className="ib-template-preview-card" />
        <i className="ib-template-preview-card" />
        <i className="ib-template-preview-card" />
        <i className="ib-template-preview-card" />
      </span>
      <span className="ib-template-copy">
        <strong>{name}</strong>
        <span>{description}</span>
      </span>
    </button>
  )
}
