import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// Register the service worker for push in development and production. Its dev mode
// bypasses fetch caching so it does not interfere with Vite's module hot reload.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const workerUrl = import.meta.env.DEV ? '/sw.js?dev=1' : '/sw.js'
      const registration = await navigator.serviceWorker.register(workerUrl)
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

      if (import.meta.env.PROD) {
        cacheLoadedFrontendFiles()
        window.setTimeout(cacheLoadedFrontendFiles, 1500)
      }
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
