import { useState } from 'react'
import './Paywall.css'

const API = import.meta.env.VITE_API_URL || ''

export default function Paywall() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  return (
    <div className="paywall">
      <div className="paywall-card">
        <div className="paywall-logo">▶ StreamFeed</div>
        <h1>All your creators.<br />One feed.</h1>
        <p className="paywall-desc">
          Follow channels from YouTube, Twitch, Kick and Rumble in one clean feed.
          No algorithm. No ads. Just the content you chose.
        </p>
        <ul className="paywall-features">
          <li>✓ YouTube, Twitch, Kick &amp; Rumble</li>
          <li>✓ Live streams pinned at the top</li>
          <li>✓ Watch Later list</li>
          <li>✓ No account required</li>
          <li>✓ Your channels stay in your browser</li>
        </ul>
        <button className="paywall-btn" onClick={handlePay} disabled={loading}>
          {loading ? 'Redirecting to payment…' : 'Get Access — €2'}
        </button>
        {error && <p className="paywall-error">{error}</p>}
        <p className="paywall-note">One-time payment · Works in this browser forever</p>
      </div>
    </div>
  )
}
