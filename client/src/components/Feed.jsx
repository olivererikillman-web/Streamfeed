import { useState, useEffect, useRef } from 'react'
import VideoCard from './VideoCard'
import './Feed.css'

const API = import.meta.env.VITE_API_URL || ''

// --- localStorage helpers ---
const LS_KEYS = {
  youtube: 'sf_youtube_channels',
  kick: 'sf_kick_channels',
  twitch: 'sf_twitch_channels',
  watchLater: 'sf_watch_later',
}

function loadFromStorage(platform) {
  try { return JSON.parse(localStorage.getItem(LS_KEYS[platform])) || [] }
  catch { return [] }
}

function saveToStorage(platform, channels) {
  localStorage.setItem(LS_KEYS[platform], JSON.stringify(channels))
}

// --- Channel manager UI ---
const PLATFORM_PLACEHOLDERS = {
  youtube: 'Channel name or @handle',
  kick: 'Channel username',
  twitch: 'Channel username',
}

function ChannelManager({ title, platform, list, newVal, setNewVal, color, onAdd, onRemove, getLabel, getKey, adding, addError, onSearch }) {
  const label = getLabel || (ch => ch)
  const key = getKey || (ch => ch)
  const [suggestions, setSuggestions] = useState([])
  const [showSug, setShowSug] = useState(false)
  const searchTimer = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowSug(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleChange = (val) => {
    setNewVal(val)
    if (onSearch && val.length >= 2) {
      clearTimeout(searchTimer.current)
      searchTimer.current = setTimeout(async () => {
        const results = await onSearch(val)
        setSuggestions(results)
        setShowSug(results.length > 0)
      }, 350)
    } else {
      setSuggestions([])
      setShowSug(false)
    }
  }

  const pickSuggestion = (s) => {
    setShowSug(false)
    setSuggestions([])
    onAdd(platform, s.slug, setNewVal, s)
  }

  const clearInput = () => { setNewVal(''); setSuggestions([]); setShowSug(false) }

  return (
    <div className="channel-manager" style={{ '--manager-color': color }}>
      <h3>{title}</h3>
      <div className="channel-add">
        <div className="input-wrap" ref={wrapRef}>
          <input
            type="text"
            placeholder={PLATFORM_PLACEHOLDERS[platform] || 'Channel username'}
            value={newVal}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { setShowSug(false); onAdd(platform, newVal, setNewVal) } if (e.key === 'Escape') setShowSug(false) }}
            onFocus={() => suggestions.length > 0 && setShowSug(true)}
            disabled={adding}
            autoComplete="off"
          />
          {newVal && <button className="input-clear" onClick={clearInput} tabIndex={-1}>✕</button>}
          {showSug && (
            <div className="suggestions-dropdown">
              {suggestions.map(s => (
                <button key={s.slug} className="suggestion-item" onMouseDown={() => pickSuggestion(s)}>
                  {s.thumbnail && <img src={s.thumbnail} className="suggestion-thumb" alt="" />}
                  <span className="suggestion-name">{s.name}</span>
                  <span className="suggestion-slug">@{s.slug}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => { setShowSug(false); onAdd(platform, newVal, setNewVal) }} disabled={adding}>
          {adding ? '...' : 'Add'}
        </button>
      </div>
      {addError && <p className="add-error">{addError}</p>}
      <div className="channel-list">
        {list.length === 0 && <span className="channel-empty">No channels yet</span>}
        {list.map(ch => (
          <div key={key(ch)} className="channel-row">
            <span>{label(ch)}</span>
            <button onClick={() => onRemove(platform, key(ch))}>✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Feed({ newPurchase = false }) {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeChannel, setActiveChannel] = useState('all')
  const [activePlatform, setActivePlatform] = useState('all')

  const [youtubeChannels, setYoutubeChannels] = useState(() => loadFromStorage('youtube'))
  const [kickChannels, setKickChannels] = useState(() => loadFromStorage('kick'))
  const [twitchChannels, setTwitchChannels] = useState(() => loadFromStorage('twitch'))

  const [newYoutubeChannel, setNewYoutubeChannel] = useState('')
  const [newKickChannel, setNewKickChannel] = useState('')
  const [newTwitchChannel, setNewTwitchChannel] = useState('')

  const [showYoutubeManager, setShowYoutubeManager] = useState(false)
  const [showKickManager, setShowKickManager] = useState(false)
  const [showTwitchManager, setShowTwitchManager] = useState(false)

  const [watchLater, setWatchLater] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEYS.watchLater)) || [] }
    catch { return [] }
  })

  const [addingYoutube, setAddingYoutube] = useState(false)
  const [youtubeAddError, setYoutubeAddError] = useState('')
  const [showKeyModal, setShowKeyModal] = useState(newPurchase)
  const [copied, setCopied] = useState(false)

  const fetchKickData = async (channels) => {
    const parseKickDate = (str) => str ? new Date(str.replace(' ', 'T') + 'Z') : new Date(0)

    const results = await Promise.allSettled(channels.map(async (slug) => {
      const [channelRes, vodsRes] = await Promise.all([
        fetch(`https://kick.com/api/v2/channels/${slug}`),
        fetch(`https://kick.com/api/v2/channels/${slug}/videos?page=1&limit=5`)
      ])
      const items = []
      if (channelRes.ok) {
        const ch = await channelRes.json()
        const username = ch.user?.username || slug
        if (ch.livestream) {
          const s = ch.livestream
          items.push({
            id: `kick-live-${slug}`,
            title: s.session_title || `${username} is live`,
            channelName: username,
            channelId: `kick-${slug}`,
            thumbnail: ch.banner_image?.url || ch.user?.profile_pic || null,
            publishedAt: parseKickDate(s.created_at).toISOString(),
            url: `https://kick.com/${slug}`,
            platform: 'kick', isLive: true, viewers: s.viewer_count
          })
        }
        if (vodsRes.ok) {
          const vodsData = await vodsRes.json()
          const vods = Array.isArray(vodsData) ? vodsData : (vodsData.data || [])
          for (const vod of vods) {
            items.push({
              id: `kick-vod-${vod.id}`,
              title: vod.session_title || vod.title || 'Untitled VOD',
              channelName: username,
              channelId: `kick-${slug}`,
              thumbnail: vod.thumbnail?.src || vod.thumbnail,
              publishedAt: parseKickDate(vod.created_at).toISOString(),
              url: `https://kick.com/${slug}/videos/${vod.video?.uuid || vod.id}`,
              platform: 'kick', isLive: false
            })
          }
        }
      }
      return items
    }))
    return results.filter(r => r.status === 'fulfilled').flatMap(r => r.value)
  }

  const fetchTwitchData = async (channels) => {
    if (channels.length === 0) return []
    try {
      const r = await fetch(`${API}/api/twitch?logins=${channels.join(',')}`)
      return r.ok ? r.json() : []
    } catch {
      return []
    }
  }

  const loadFeed = async (yt = youtubeChannels, kick = kickChannels, twitch = twitchChannels) => {
    setLoading(true)
    setError(null)

    const ytParams = yt.length > 0
      ? `ids=${yt.map(c => c.id).join(',')}&names=${yt.map(c => encodeURIComponent(c.name)).join(',')}`
      : null

    const ytTimeout = new Promise(resolve => setTimeout(() => resolve([]), 14000))
    const [ytVideos, kickVideos, twitchVideos] = await Promise.all([
      ytParams
        ? Promise.race([
            fetch(`${API}/api/feed?${ytParams}`).then(r => r.ok ? r.json() : []).catch(() => []),
            ytTimeout,
          ])
        : Promise.resolve([]),
      fetchKickData(kick),
      fetchTwitchData(twitch),
    ])

    const seen = new Set()
    const all = [...ytVideos, ...kickVideos, ...twitchVideos]
      .sort((a, b) => {
        // Live items always beat their matching VOD in dedup — sort them first
        if (a.isLive && !b.isLive) return -1
        if (!a.isLive && b.isLive) return 1
        return new Date(b.publishedAt) - new Date(a.publishedAt)
      })
      .filter(v => {
        const key = `${v.channelName?.toLowerCase()}::${v.title?.toLowerCase().trim()}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    setVideos(all)
    setLoading(false)
  }

  useEffect(() => { loadFeed() }, [])

  const addChannel = async (platform, username, setter) => {
    const val = username.trim()
    if (!val) return

    if (platform === 'youtube') {
      setAddingYoutube(true)
      setYoutubeAddError('')
      try {
        const res = await fetch(`${API}/api/youtube/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: val })
        })
        if (!res.ok) {
          const err = await res.json()
          setYoutubeAddError(err.error || 'Channel not found')
          return
        }
        const resolved = await res.json()
        const current = loadFromStorage('youtube')
        if (!current.find(c => c.id === resolved.id)) {
          const updated = [...current, { ...resolved, handle: val }]
          saveToStorage('youtube', updated)
          setYoutubeChannels(updated)
          setter('')
          loadFeed(updated, kickChannels, twitchChannels)
        } else {
          setter('')
        }
      } finally {
        setAddingYoutube(false)
      }
    } else {
      const slug = val.toLowerCase()
      const current = loadFromStorage(platform)
      if (!current.includes(slug)) {
        const updated = [...current, slug]
        saveToStorage(platform, updated)
        if (platform === 'kick') { setKickChannels(updated); setter(''); loadFeed(youtubeChannels, updated, twitchChannels) }
        if (platform === 'twitch') { setTwitchChannels(updated); setter(''); loadFeed(youtubeChannels, kickChannels, updated) }
      } else {
        setter('')
      }
    }
  }

  const removeChannel = (platform, key) => {
    if (platform === 'youtube') {
      const updated = youtubeChannels.filter(c => c.id !== key)
      saveToStorage('youtube', updated)
      setYoutubeChannels(updated)
      loadFeed(updated, kickChannels, twitchChannels)
    } else {
      const current = loadFromStorage(platform)
      const updated = current.filter(c => c !== key)
      saveToStorage(platform, updated)
      if (platform === 'kick') { setKickChannels(updated); loadFeed(youtubeChannels, updated, twitchChannels) }
      if (platform === 'twitch') { setTwitchChannels(updated); loadFeed(youtubeChannels, kickChannels, updated) }
    }
  }

  const toggleWatchLater = (video) => {
    const id = video.id || video.videoId
    const exists = watchLater.find(v => (v.id || v.videoId) === id)
    const updated = exists
      ? watchLater.filter(v => (v.id || v.videoId) !== id)
      : [video, ...watchLater]
    setWatchLater(updated)
    localStorage.setItem(LS_KEYS.watchLater, JSON.stringify(updated))
  }

  const platformFiltered = activePlatform === 'all' ? videos : videos.filter(v => v.platform === activePlatform)

  // Build channelMeta from both loaded videos AND stored channels
  const channelMeta = {}
  videos.forEach(v => {
    if (!channelMeta[v.channelName]) {
      channelMeta[v.channelName] = { platform: v.platform, key: v.platform === 'youtube' ? v.channelId : v.channelName }
    }
  })
  youtubeChannels.forEach(ch => {
    if (!channelMeta[ch.name]) channelMeta[ch.name] = { platform: 'youtube', key: ch.id }
  })
  kickChannels.forEach(slug => {
    const vid = videos.find(v => v.platform === 'kick' && v.channelId === `kick-${slug}`)
    const name = vid?.channelName || slug
    if (!channelMeta[name]) channelMeta[name] = { platform: 'kick', key: slug }
  })
  twitchChannels.forEach(login => {
    const vid = videos.find(v => v.platform === 'twitch' && v.channelId === `twitch-${login}`)
    const name = vid?.channelName || login
    if (!channelMeta[name]) channelMeta[name] = { platform: 'twitch', key: login }
  })

  // Build pill list from ALL stored channels, not just ones with videos
  const allChannelNames = new Set(platformFiltered.map(v => v.channelName))
  if (activePlatform === 'all' || activePlatform === 'youtube') youtubeChannels.forEach(ch => allChannelNames.add(ch.name))
  if (activePlatform === 'all' || activePlatform === 'kick') kickChannels.forEach(slug => {
    const vid = videos.find(v => v.platform === 'kick' && v.channelId === `kick-${slug}`)
    allChannelNames.add(vid?.channelName || slug)
  })
  if (activePlatform === 'all' || activePlatform === 'twitch') twitchChannels.forEach(login => {
    const vid = videos.find(v => v.platform === 'twitch' && v.channelId === `twitch-${login}`)
    allChannelNames.add(vid?.channelName || login)
  })
  const channels = ['all', ...Array.from(allChannelNames).sort()]
  const filtered = activeChannel === 'all' ? platformFiltered : platformFiltered.filter(v => v.channelName === activeChannel)
  const liveVideos = filtered.filter(v => v.isLive)
  const vodVideos = filtered.filter(v => !v.isLive)

  const switchPlatform = (platform, toggleManager, ...closeManagers) => {
    if (activePlatform !== platform) setActiveChannel('all')
    setActivePlatform(platform)
    toggleManager(m => !m)
    closeManagers.forEach(fn => fn(false))
  }

  const hasNoChannels = youtubeChannels.length === 0 && kickChannels.length === 0 && twitchChannels.length === 0

  return (
    <div className="feed-layout">
      <header className="feed-header">
        <div className="feed-title">Subfeed</div>

        <div className="header-actions">
          <button
            className={`platform-mgr-btn all-btn ${activePlatform === 'all' ? 'all-btn-active' : ''}`}
            onClick={() => { setActivePlatform('all'); setActiveChannel('all'); setShowYoutubeManager(false); setShowKickManager(false); setShowTwitchManager(false) }}
          >
            All
          </button>
          <button
            className={`platform-mgr-btn youtube-color ${activePlatform !== 'all' && activePlatform !== 'youtube' ? 'platform-inactive' : ''}`}
            onClick={() => switchPlatform('youtube', setShowYoutubeManager, setShowKickManager, setShowTwitchManager)}
          >
            YouTube
          </button>
          <button
            className={`platform-mgr-btn twitch-color ${activePlatform !== 'all' && activePlatform !== 'twitch' ? 'platform-inactive' : ''}`}
            onClick={() => switchPlatform('twitch', setShowTwitchManager, setShowKickManager, setShowYoutubeManager)}
          >
            Twitch
          </button>
          <button
            className={`platform-mgr-btn kick-color ${activePlatform !== 'all' && activePlatform !== 'kick' ? 'platform-inactive' : ''}`}
            onClick={() => switchPlatform('kick', setShowKickManager, setShowTwitchManager, setShowYoutubeManager)}
          >
            Kick
          </button>
          <button className="logout-btn" onClick={() => { localStorage.removeItem('sf_license'); window.location.reload() }}>Log out</button>
          <button className="key-btn" onClick={() => setShowKeyModal(true)} title="View your license key">🔑</button>
        </div>
      </header>

      {showKeyModal && (() => {
        let isTrial = false
        try { const p = JSON.parse(atob((localStorage.getItem('sf_license') || '').split('.')[1])); isTrial = !!p.trial } catch {}
        return (
          <div className="key-modal-backdrop" onClick={() => setShowKeyModal(false)}>
            <div className="key-modal" onClick={e => e.stopPropagation()}>
              {isTrial ? (
                <>
                  <h3>Free Trial Active</h3>
                  <p>You're on a 7-day free trial. Your channels are saved in your browser — you won't lose them when the trial ends. To keep access permanently, pay once for €1 and you'll get a key to restore access on any device.</p>
                </>
              ) : (
                <>
                  <h3>Your License Key</h3>
                  <p>⚠️ Copy this key and save it somewhere safe (notes app, email to yourself, etc.). This is the only way to restore access if you clear your browser or switch devices. It cannot be recovered.</p>
                  <textarea className="key-modal-text" readOnly value={localStorage.getItem('sf_license') || ''} rows={4} />
                </>
              )}
              <div className="key-modal-actions">
                {!isTrial && (
                  <button className="key-modal-copy" onClick={() => { navigator.clipboard.writeText(localStorage.getItem('sf_license') || ''); setCopied(true); setTimeout(() => setCopied(false), 2000) }}>
                    {copied ? 'Copied!' : 'Copy key'}
                  </button>
                )}
                <button className="key-modal-close" onClick={() => setShowKeyModal(false)}>
                  {isTrial ? 'Got it' : "I've saved my key"}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {showYoutubeManager && (
        <ChannelManager
          title="YouTube Channels" platform="youtube"
          list={youtubeChannels} newVal={newYoutubeChannel} setNewVal={setNewYoutubeChannel}
          color="#ff0000" onAdd={addChannel} onRemove={removeChannel}
          getLabel={ch => ch.name} getKey={ch => ch.id}
          adding={addingYoutube} addError={youtubeAddError}
        />
      )}
      {showKickManager && (
        <ChannelManager
          title="Kick Channels" platform="kick"
          list={kickChannels} newVal={newKickChannel} setNewVal={setNewKickChannel}
          color="#53fc18" onAdd={addChannel} onRemove={removeChannel}
        />
      )}
      {showTwitchManager && (
        <ChannelManager
          title="Twitch Channels" platform="twitch"
          list={twitchChannels} newVal={newTwitchChannel} setNewVal={setNewTwitchChannel}
          color="#9147ff" onAdd={addChannel} onRemove={removeChannel}
        />
      )}

      {!loading && !hasNoChannels && !showYoutubeManager && !showKickManager && !showTwitchManager && (
        <div className="filter-bar">
          {channels.map(ch => (
            <div key={ch} className={`filter-pill ${activeChannel === ch ? 'active' : ''}`}>
              <span onClick={() => setActiveChannel(ch)}>
                {ch === 'all' ? 'All channels' : ch}
              </span>
              {ch !== 'all' && channelMeta[ch] && (
                <button
                  className="filter-pill-remove"
                  onClick={e => {
                    e.stopPropagation()
                    if (activeChannel === ch) setActiveChannel('all')
                    const { platform, key } = channelMeta[ch]
                    removeChannel(platform, key)
                  }}
                >✕</button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="feed-body">
        <main className="feed-main">
          {loading && <div className="state-msg">Loading your feed...</div>}
          {error && <div className="state-msg error">{error}</div>}
          {!loading && !error && hasNoChannels && (
            <div className="welcome-state">
              <h2 className="welcome-title">Welcome to Subfeed</h2>
              <p className="welcome-sub">Add your subscriptions to see all your content in one feed.</p>
              <div className="welcome-platforms">
                <div className="welcome-platform-card" onClick={() => { setActivePlatform('youtube'); setShowYoutubeManager(true); setShowKickManager(false); setShowTwitchManager(false) }}>
                  <span className="wpc-badge youtube">YT</span>
                  <span className="wpc-name">YouTube</span>
                  <span className="wpc-hint">Click to add channels →</span>
                </div>
                <div className="welcome-platform-card" onClick={() => { setActivePlatform('twitch'); setShowTwitchManager(true); setShowKickManager(false); setShowYoutubeManager(false) }}>
                  <span className="wpc-badge twitch">Twitch</span>
                  <span className="wpc-name">Twitch</span>
                  <span className="wpc-hint">Click to add channels →</span>
                </div>
                <div className="welcome-platform-card" onClick={() => { setActivePlatform('kick'); setShowKickManager(true); setShowTwitchManager(false); setShowYoutubeManager(false) }}>
                  <span className="wpc-badge kick">Kick</span>
                  <span className="wpc-name">Kick</span>
                  <span className="wpc-hint">Click to add channels →</span>
                </div>
              </div>
              <p className="welcome-note">No login needed. No data collected.</p>
            </div>
          )}
          {!loading && !error && !hasNoChannels && filtered.length === 0 && (
            <div className="state-msg">No videos found for this filter.</div>
          )}
          {!loading && !error && liveVideos.length > 0 && (
            <section className="live-section">
              <h2 className="live-section-title">
                <span className="live-dot" />
                Live Now
                <span className="live-count">{liveVideos.length}</span>
              </h2>
              <div className="live-grid">
                {liveVideos.map(video => (
                  <VideoCard
                    key={video.id || video.videoId} video={video}
                    onWatchLater={toggleWatchLater}
                    inWatchLater={!!watchLater.find(v => (v.id || v.videoId) === (video.id || video.videoId))}
                  />
                ))}
              </div>
            </section>
          )}
          {!loading && !error && vodVideos.length > 0 && (
            <div className="video-grid">
              {vodVideos.map(video => (
                <VideoCard
                  key={video.id || video.videoId} video={video}
                  onWatchLater={toggleWatchLater}
                  inWatchLater={!!watchLater.find(v => (v.id || v.videoId) === (video.id || video.videoId))}
                />
              ))}
            </div>
          )}
        </main>

        <aside className="watch-later-panel">
          <h3 className="wl-title">⏱ Watch Later</h3>
          {watchLater.length === 0
            ? <p className="wl-empty">Hover a video and click the clock to save it.</p>
            : watchLater.map(video => {
                const id = video.id || video.videoId
                return (
                  <div key={id} className="wl-item">
                    <a href={video.url} target="_blank" rel="noopener noreferrer" className="wl-thumb-link">
                      <img src={video.thumbnail} alt={video.title} referrerPolicy="no-referrer" />
                    </a>
                    <div className="wl-info">
                      <a href={video.url} target="_blank" rel="noopener noreferrer" className="wl-item-title">{video.title}</a>
                      <span className="wl-item-channel">{video.channelName}</span>
                    </div>
                    <button className="wl-remove" onClick={() => toggleWatchLater(video)} title="Remove">✕</button>
                  </div>
                )
              })
          }
        </aside>
      </div>
    </div>
  )
}
