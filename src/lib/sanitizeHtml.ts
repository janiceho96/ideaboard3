const SAFE_URL_RE = /^(https?:|mailto:|tel:|#|\/)/i
const SAFE_STYLE_PROPS = new Set([
  'background-color',
  'color',
  'font-size',
  'font-style',
  'font-weight',
  'text-decoration',
])

function sanitizeStyle(style: string): string {
  return style
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const sep = part.indexOf(':')
      if (sep === -1) return ''
      const prop = part.slice(0, sep).trim().toLowerCase()
      const value = part.slice(sep + 1).trim()
      if (!SAFE_STYLE_PROPS.has(prop)) return ''
      if (/url\s*\(|expression\s*\(|javascript:/i.test(value)) return ''
      return `${prop}: ${value}`
    })
    .filter(Boolean)
    .join('; ')
}

function fallbackSanitize(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '')
}

export function sanitizeHtml(html: string): string {
  if (!html) return ''
  if (typeof document === 'undefined') return fallbackSanitize(html)

  const template = document.createElement('template')
  template.innerHTML = html

  template.content.querySelectorAll('script, style, iframe, object, embed, link, meta').forEach(el => el.remove())

  template.content.querySelectorAll('*').forEach(el => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase()
      const value = attr.value.trim()

      if (name.startsWith('on')) {
        el.removeAttribute(attr.name)
        continue
      }

      if (name === 'href') {
        if (el.tagName.toLowerCase() !== 'a' || !SAFE_URL_RE.test(value)) {
          el.removeAttribute(attr.name)
        }
        continue
      }

      if (name === 'target' || name === 'rel') {
        if (el.tagName.toLowerCase() !== 'a') el.removeAttribute(attr.name)
        continue
      }

      if (name === 'style') {
        const safeStyle = sanitizeStyle(value)
        if (safeStyle) el.setAttribute('style', safeStyle)
        else el.removeAttribute(attr.name)
        continue
      }

      el.removeAttribute(attr.name)
    }
  })

  return template.innerHTML
}
