import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './shared/theme.css'
import './shell.css'
import { loadInstalledFonts } from './shared/fonts'

loadInstalledFonts()

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
