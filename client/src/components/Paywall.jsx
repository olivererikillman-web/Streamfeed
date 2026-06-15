import { useState } from 'react'
import './Paywall.css'

const API = import.meta.env.VITE_API_URL || ''
const LS_LICENSE = 'sf_license'

export default function Paywall({ onUnlock }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [restoring, setRestoring] = useState(false)
  const [restoreKey, setRestoreKey] = useState('')
  const [restoreError, setRestoreError] = useState('')
  const [restoreLoading, setRestoreLoading] = useState(false)

  const handlePay = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/checkout`, { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError('Something went wrong. Please try again.')
        setLoading(false)
      }
    } catch {
      setError('Could not connect to payment server.')
      setLoading(false)
    }
  }

  const handleRestore = async () => {
    const key = restoreKey.trim()
    if (!key) return
    setRestoreLoading(true)
    setRestoreError('')
    try {
      const res = await fetch(`${API}/api/verify-license?key=${encodeURIComponent(key)}`)
      const data = await res.json()
      if (data.valid) {
        localStorage.setItem(LS_LICENSE, key)
        window.location.reload()
      } else {
        setRestoreError('Invalid key.')
      }
    } catch {
      setRestoreError('Could not connect. Try again.')
    } finally {
      setRestoreLoading(false)
    }
  }

  return (
    <div className="paywall">
      <div className="paywall-card">
        <div className="paywall-logo">Subfeed</div>
        <h1>All your creators.<br />One feed.</h1>
        <p className="paywall-desc">
          Follow channels from YouTube, Twitch and Kick in one clean feed.
          No algorithm. No ads. Just the content you chose.
        </p>
        <ul className="paywall-features">
          <li>✓ YouTube, Twitch &amp; Kick</li>
          <li>✓ Live streams pinned at the top</li>
          <li>✓ Watch Later list</li>
          <li>✓ No account required</li>
          <li>✓ Your channels stay in your browser</li>
        </ul>
        <button className="paywall-btn" onClick={handlePay} disabled={loading}>
          {loading ? 'Redirecting to payment…' : 'Get Access — €1'}
        </button>
        {error && <p className="paywall-error">{error}</p>}
        <p className="paywall-note">One-time payment · Works in this browser forever</p>

        <div className="paywall-divider" />

        {!restoring ? (
          <button className="paywall-restore-link" onClick={() => setRestoring(true)}>
            Already paid? Restore access
          </button>
        ) : (
          <div className="paywall-restore">
            <p className="paywall-restore-label">Paste your license key:</p>
            <textarea
              className="paywall-restore-input"
              value={restoreKey}
              onChange={e => setRestoreKey(e.target.value)}
              placeholder="Paste key here…"
              rows={3}
            />
            {restoreError && <p className="paywall-error">{restoreError}</p>}
            <div className="paywall-restore-actions">
              <button className="paywall-restore-btn" onClick={handleRestore} disabled={restoreLoading}>
                {restoreLoading ? 'Checking…' : 'Restore'}
              </button>
              <button className="paywall-restore-cancel" onClick={() => { setRestoring(false); setRestoreKey(''); setRestoreError('') }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
