import { useState, useEffect } from 'react'
import Feed from './components/Feed'
import Paywall from './components/Paywall'
import './App.css'

const API = import.meta.env.VITE_API_URL || ''
const LS_LICENSE = 'sf_license'

export default function App() {
  const [status, setStatus] = useState('checking') // 'checking' | 'licensed' | 'unlicensed'

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('session_id')

    if (sessionId) {
      // Returning from Stripe — activate license
      fetch(`${API}/api/activate?session_id=${encodeURIComponent(sessionId)}`)
        .then(r => r.json())
        .then(data => {
          if (data.license) {
            localStorage.setItem(LS_LICENSE, data.license)
            window.history.replaceState({}, '', '/')
            setStatus('licensed')
          } else {
            setStatus('unlicensed')
          }
        })
        .catch(() => setStatus('unlicensed'))
    } else {
      // Check existing license in localStorage
      const key = localStorage.getItem(LS_LICENSE)
      if (!key) return setStatus('unlicensed')

      fetch(`${API}/api/verify-license?key=${encodeURIComponent(key)}`)
        .then(r => r.json())
        .then(data => setStatus(data.valid ? 'licensed' : 'unlicensed'))
        .catch(() => setStatus('unlicensed'))
    }
  }, [])

  if (status === 'checking') return <div className="loading-screen">Loading…</div>
  if (status === 'unlicensed') return <Paywall />
  return <Feed />
}
