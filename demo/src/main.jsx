import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// The page picks its version (#roll, #record) on load, so switching the hash in an open tab reloads it.
window.addEventListener('hashchange', () => location.reload())
