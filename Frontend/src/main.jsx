import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// Register the app-shell cache only in production; Vite dev mode should stay uncached.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      const readyRegistration = await navigator.serviceWorker.ready

      const cacheLoadedFrontendFiles = () => {
        const urls = performance
          .getEntriesByType('resource')
          .map((entry) => entry.name)
          .filter((name) => {
            try {
              const url = new URL(name)
              return url.origin === window.location.origin &&
                /\.(js|css|svg|png|jpe?g|webp|ico|woff2?)$/i.test(url.pathname)
            } catch {
              return false
            }
          })

        const worker = navigator.serviceWorker.controller || readyRegistration.active || registration.active
        worker?.postMessage({ type: 'PRECACHE_FRONTEND_RESOURCES', urls })
      }

      cacheLoadedFrontendFiles()
      window.setTimeout(cacheLoadedFrontendFiles, 1500)
    } catch (error) {
      console.warn('FixFlow offline support could not be enabled.', error)
    }
  }, { once: true })
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
