import { useId } from 'react'
import type { CustomFrameworkTemplate, FrameworkArea, FrameworkLayout } from '../types'

const NAVY = '#263D5B'
const COLORS = ['#FFE378', '#FF9E91', '#AEE3C9', '#8FD8E5', '#D5C6FF', '#F5AFCB']
const PERIMETER = [[50, 32.1667], [82.1667, 32.1667], [82.1667, 57], [82.1667, 81.8333], [50, 81.8333], [17.8333, 81.8333], [17.8333, 57], [17.8333, 32.1667]]

function center(area: FrameworkArea): number[] {
  return [area.left + area.width / 2, area.top + area.height / 2]
}

function edge(area: FrameworkArea, toward: number[]): number[] {
  const origin = center(area)
  const dx = toward[0] - origin[0]
  const dy = toward[1] - origin[1]
  const scale = 1 / Math.max(Math.abs(dx) / (area.width / 2), Math.abs(dy) / (area.height / 2))
  return [origin[0] + dx * scale, origin[1] + dy * scale]
}

function cyclePath(sections: FrameworkArea[], index: number): string {
  const startSlot = Math.floor(index * 8 / sections.length)
  const endSlot = index === sections.length - 1 ? 8 : Math.floor((index + 1) * 8 / sections.length)
  const next = sections[(index + 1) % sections.length]
  const waypoints = PERIMETER.slice(startSlot + 1, endSlot)
  const start = edge(sections[index], waypoints[0] ?? center(next))
  const end = edge(next, waypoints[waypoints.length - 1] ?? center(sections[index]))
  return `M ${start.join(' ')} ${[...waypoints, end].map(point => `L ${point.join(' ')}`).join(' ')}`
}

function flowPath(current: FrameworkArea, next: FrameworkArea): string {
  if (Math.abs(current.top - next.top) < 0.01) {
    return `M ${current.left + current.width} ${current.top + current.height / 2} L ${next.left} ${next.top + next.height / 2}`
  }
  const bottom = current.top + current.height
  const middle = (bottom + next.top) / 2
  const right = Math.min(99, current.left + current.width + 1.5)
  const left = Math.max(1, next.left - 1.5)
  return `M ${current.left + current.width} ${current.top + current.height / 2} L ${right} ${current.top + current.height / 2} L ${right} ${middle} L ${left} ${middle} L ${left} ${next.top + next.height / 2} L ${next.left} ${next.top + next.height / 2}`
}

export function FrameworkLayoutDecorations({ template, dark }: { template: CustomFrameworkTemplate; dark: boolean }) {
  const markerId = `framework-arrow-${useId().replace(/:/g, '')}`
  const ink = dark ? '#A9CBE0' : NAVY
  return <>
    {(template.layout === 'flow' || template.layout === 'cycle') && <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      <defs><marker id={markerId} viewBox="0 0 4 4" refX="3.6" refY="2" markerWidth="3" markerHeight="3" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M 0 0 L 4 2 L 0 4 Z" fill={ink} /></marker></defs>
      {template.sections.map((section, index) => {
        const next = template.sections[index + 1]
        if (template.layout === 'flow' && !next) return null
        return <path key={section.id} d={template.layout === 'cycle' ? cyclePath(template.sections, index) : flowPath(section, next)} fill="none" stroke={ink} strokeWidth="0.3" strokeLinejoin="round" markerEnd={`url(#${markerId})`} />
      })}
    </svg>}
    {template.layout === 'matrix' && <div aria-hidden="true" style={{ color: ink, fontFamily: "'DM Sans',sans-serif", fontSize: 9, fontWeight: 700 }}>
      {['Column 1', 'Column 2'].map((label, index) => <span key={label} style={{ position: 'absolute', top: '20%', left: `${template.sections[index].left}%`, width: `${template.sections[index].width}%`, textAlign: 'center' }}>{label}</span>)}
      {['Row 1', 'Row 2'].map((label, index) => <span key={label} style={{ position: 'absolute', left: '1%', top: `${template.sections[index * 2].top + template.sections[index * 2].height / 2}%`, writingMode: 'vertical-rl', transform: 'translateY(-50%) rotate(180deg)' }}>{label}</span>)}
    </div>}
    {template.layout === 'cycle' && <span aria-hidden="true" style={{ position: 'absolute', left: '37%', width: '26%', top: '54%', textAlign: 'center', fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: ink }}>Repeat ↻</span>}
  </>
}

export function FrameworkLayoutSurface({ template, dark, width, showGuidance = false }: { template: CustomFrameworkTemplate; dark: boolean; width: number; showGuidance?: boolean }) {
  const ink = dark ? '#F7F7F2' : NAVY
  return <div aria-hidden={!showGuidance} style={{ position: 'absolute', inset: 0, border: `2px solid ${NAVY}`, borderRadius: 8, background: dark ? '#19263A' : '#FFFDF5', overflow: 'hidden', boxSizing: 'border-box' }}>
    <div style={{ position: 'absolute', left: '3%', right: '3%', top: '4%', height: '13%', color: ink, fontFamily: "'DM Sans',sans-serif", fontSize: Math.max(10, Math.min(14, width / 66)), fontWeight: 600, lineHeight: 1.3, overflow: 'hidden' }}>{template.purpose}</div>
    <FrameworkLayoutDecorations template={template} dark={dark} />
    {template.sections.map((section, index) => <div key={section.id} title={`${section.label}: ${section.writingGuidance}`} style={{ position: 'absolute', left: `${section.left}%`, top: `${section.top}%`, width: `${section.width}%`, height: `${section.height}%`, boxSizing: 'border-box', overflow: showGuidance ? 'auto' : 'hidden', border: `2px solid ${NAVY}`, borderRadius: 7, background: dark ? `${COLORS[index % COLORS.length]}22` : `${COLORS[index % COLORS.length]}88` }}>
      <div style={{ display: 'flex', alignItems: 'center', minHeight: 24, padding: '3px 7px', background: dark ? NAVY : COLORS[index % COLORS.length], borderBottom: `1px solid ${NAVY}`, color: ink, fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: showGuidance ? 11 : 10, lineHeight: 1.2, boxSizing: 'border-box', overflowWrap: 'anywhere' }}>
        {template.layout === 'flow' || template.layout === 'cycle' ? `${index + 1}. ` : ''}{section.label}
      </div>
      {showGuidance && <p style={{ margin: 0, padding: '6px 7px', color: ink, fontFamily: "'DM Sans',sans-serif", fontSize: 11, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{section.writingGuidance}</p>}
    </div>)}
  </div>
}

export default function FrameworkLayoutPreview({ template, dark }: { template: CustomFrameworkTemplate; dark: boolean }) {
  return <div role="region" aria-label={`${template.label} layout preview`} style={{ position: 'relative', width: '100%', aspectRatio: `${template.defaultSize.width} / ${template.defaultSize.height}`, minHeight: 300 }}>
    <FrameworkLayoutSurface template={template} dark={dark} width={660} showGuidance />
  </div>
}

export function FrameworkLayoutThumbnail({ layout }: { layout: FrameworkLayout }) {
  const arrowId = `layout-choice-${useId().replace(/:/g, '')}`
  const ink = 'currentColor'
  const boxes = layout === 'cycle'
    ? [[44, 7, 30, 20], [82, 35, 30, 20], [44, 63, 30, 20], [6, 35, 30, 20]]
    : layout === 'flow'
      ? [[4, 32, 28, 28], [45, 32, 28, 28], [86, 32, 28, 28]]
      : [[10, 8, 43, 32], [67, 8, 43, 32], [10, 52, 43, 32], [67, 52, 43, 32]]
  return <svg aria-hidden="true" viewBox="0 0 120 90" style={{ display: 'block', width: '100%', height: 72 }}>
    <defs><marker id={arrowId} viewBox="0 0 4 4" refX="3.5" refY="2" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0L4 2L0 4Z" fill={ink} /></marker></defs>
    {layout === 'cycle' && <path d="M76 18Q98 18 98 32 M98 58Q98 75 78 75 M41 75Q22 75 22 58 M22 32Q22 18 41 18" fill="none" stroke={ink} strokeWidth="1.5" markerEnd={`url(#${arrowId})`} />}
    {layout === 'flow' && <><path d="M33 46H42" stroke={ink} strokeWidth="1.5" markerEnd={`url(#${arrowId})`} /><path d="M74 46H83" stroke={ink} strokeWidth="1.5" markerEnd={`url(#${arrowId})`} /></>}
    {layout === 'matrix' && <path d="M60 5V87M6 46H114" stroke={ink} strokeWidth="1.5" strokeDasharray="3 3" />}
    {boxes.map(([x, y, width, height], index) => <g key={index}><rect x={x} y={y} width={width} height={height} rx="4" fill={COLORS[index]} stroke={ink} strokeWidth="1.5" /><path d={`M${x + 6} ${y + 7}H${x + width - 6}`} stroke={NAVY} strokeWidth="1.5" opacity="0.6" /></g>)}
  </svg>
}
