import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/markerWorkshop.css'

// Fonts
const link = document.createElement('link')
link.rel = 'stylesheet'
link.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Syne:wght@600;700;800&display=swap'
document.head.appendChild(link)

// Global reset
const style = document.createElement('style')
style.textContent = `
  :root {
    --ideaboard-primary: #6957FF;
    --ideaboard-ink: #172038;
    --ideaboard-ink-dark: #10172A;
    --ideaboard-canvas-light: #F7F7F2;
    --ideaboard-canvas-dark: #10182A;
    --ideaboard-border-light: #D9DBE2;
    --ideaboard-border-dark: #30405E;
    --ideaboard-font-ui: 'DM Sans', sans-serif;
    --ideaboard-font-display: 'Delius Swash Caps', cursive;
    --ideaboard-font-body: 'Delius', cursive;
    --ideaboard-font-mono: 'JetBrains Mono', monospace;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { overflow: hidden; }
  body[data-theme="dark"] { color-scheme: dark; }
  @keyframes snapBounce{0%{transform:scale(1)}25%{transform:scale(.88)}65%{transform:scale(1.15)}100%{transform:scale(1)}}
`
document.head.appendChild(style)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
)
