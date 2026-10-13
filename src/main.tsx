import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/markerWorkshop.css'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/700.css'
import '@fontsource/syne/600.css'
import '@fontsource/syne/700.css'
import '@fontsource/syne/800.css'
import '@fontsource/delius/400.css'
import '@fontsource/delius-swash-caps/400.css'
import '@fontsource/lora/400.css'
import '@fontsource/lora/700.css'
import '@fontsource/caveat/500.css'
import '@fontsource/caveat/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/700.css'

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
