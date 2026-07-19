import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// Fonts
const link = document.createElement('link')
link.rel = 'stylesheet'
link.href = 'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap'
document.head.appendChild(link)

// Global reset
const style = document.createElement('style')
style.textContent = `
  :root {
    --ideaboard-primary: #49B6E5;
    --ideaboard-ink: #263D5B;
    --ideaboard-ink-dark: #152336;
    --ideaboard-canvas-light: #faf8f0;
    --ideaboard-canvas-dark: #0D1B2E;
    --ideaboard-border-light: #e8e4d9;
    --ideaboard-border-dark: #1E3451;
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
