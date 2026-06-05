import { useState, useEffect } from 'react'
import VideoCard from './VideoCard'
import './Feed.css'

const TWITCH_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko'
const API = import.meta.env.VITE_API_URL || ''

// --- localStorage helpers ---
const LS_KEYS = {
  youtube: 'sf_youtube_channels',
  kick: 'sf_kick_channels',
  twitch: 'sf_twitch_channels',
  rumble: 'sf_rumble_channels',
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
function ChannelManager({ title, platform, list, newVal, setNewVal, color, onAdd, onRemove, getLabel, getKey, adding, addError }) {
  const label = getLabel || (ch => ch)
  const key = getKey || (ch => ch)
  return (
    <div className="channel-manager" style={{ '--manager-color': color }}>
      <h3>{title}</h3>
      <div className="channel-add">
        <div className="input-wrap">
          <input
            type="text"
            placeholder="Channel username"
            value={newVal}
            onChange={e => setNewVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onAdd(platform, newVal, setNewVal)}
            disabled={adding}
          />
          {newVal && <button className="input-clear" onClick={() => setNewVal('')} tabIndex={-1}>✕</button>}
        </div>
        <button onClick={() => onAdd(platform, newVal, setNewVal)} disabled={adding}>
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

export default function Feed() {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeChannel, setActiveChannel] = useState('all')
  const [activePlatform, setActivePlatform] = useState('all')

  const [youtubeChannels, setYoutubeChannels] = useState(() => loadFromStorage('youtube'))
  const [kickChannels, setKickChannels] = useState(() => loadFromStorage('kick'))
  const [twitchChannels, setTwitchChannels] = useState(() => loadFromStorage('twitch'))
  const [rumbleChannels, setRumbleChannels] = useState(() => loadFromStorage('rumble'))

  const [newYoutubeChannel, setNewYoutubeChannel] = useState('')
  const [newKickChannel, setNewKickChannel] = useState('')
  const [newTwitchChannel, setNewTwitchChannel] = useState('')
  const [newRumbleChannel, setNewRumbleChannel] = useState('')

  const [showYoutubeManager, setShowYoutubeManager] = useState(false)
  const [showKickManager, setShowKickManager] = useState(false)
  const [showTwitchManager, setShowTwitchManager] = useState(false)
  const [showRumbleManager, setShowRumbleManager] = useState(false)

  const [watchLater, setWatchLater] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEYS.watchLater)) || [] }
    catch { return [] }
  })

  const [addingYoutube, setAddingYoutube] = useState(false)
  const [youtubeAddError, setYoutubeAddError] = useState('')

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
            thumbnail: s.thumbnail?.url || ch.banner_image?.url,
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

    const results = await Promise.allSettled(channels.map(async (login) => {
      const gqlQuery = (query) => fetch('https://gql.twitch.tv/gql', {
        method: 'POST',
        headers: { 'Client-ID': TWITCH_CLIENT_ID, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      }).then(r => r.json())

      const [streamData, vodsData] = await Promise.all([
        gqlQuery(`{ user(login:"${login}") { displayName stream { title viewersCount createdAt previewImageURL(width:320,height:180) } } }`),
        gqlQuery(`{ user(login:"${login}") { displayName videos(first:5,type:ARCHIVE) { edges { node { id title publishedAt previewThumbnailURL(width:320,height:180) } } } } }`)
      ])

      const items = []
      const user = streamData?.data?.user
      const displayName = user?.displayName || login

      if (user?.stream) {
        const s = user.stream
        items.push({
          id: `twitch-live-${login}`,
          title: s.title || `${displayName} is live`,
          channelName: displayName,
          channelId: `twitch-${login}`,
          thumbnail: s.previewImageURL,
          publishedAt: s.createdAt,
          url: `https://twitch.tv/${login}`,
          platform: 'twitch', isLive: true, viewers: s.viewersCount
        })
      }

      const vodUser = vodsData?.data?.user
      const vods = vodUser?.videos?.edges || []
      for (const { node: vod } of vods) {
        items.push({
          id: `twitch-vod-${vod.id}`,
          title: vod.title || 'Untitled VOD',
          channelName: displayName,
          channelId: `twitch-${login}`,
          thumbnail: vod.previewThumbnailURL,
          publishedAt: vod.publishedAt,
          url: `https://twitch.tv/videos/${vod.id}`,
          platform: 'twitch', isLive: false
        })
      }

      return items
    }))
    return results.filter(r => r.status === 'fulfilled').flatMap(r => r.value)
  }

  const loadFeed = async (yt = youtubeChannels, kick = kickChannels, twitch = twitchChannels, rumble = rumbleChannels) => {
    setLoading(true)
    setError(null)

    const ytParams = yt.length > 0
      ? `ids=${yt.map(c => c.id).join(',')}&names=${yt.map(c => encodeURIComponent(c.name)).join(',')}`
      : null

    const rumbleParams = rumble.length > 0
      ? `slugs=${rumble.join(',')}`
      : null

    const [ytVideos, kickVideos, twitchVideos, rumbleVideos] = await Promise.all([
      ytParams
        ? fetch(`${API}/api/feed?${ytParams}`).then(r => r.ok ? r.json() : []).catch(() => [])
        : Promise.resolve([]),
      fetchKickData(kick),
      fetchTwitchData(twitch),
      rumbleParams
        ? fetch(`${API}/api/rumble/feed?${rumbleParams}`).then(r => r.ok ? r.json() : []).catch(() => [])
        : Promise.resolve([])
    ])

    const all = [...ytVideos, ...kickVideos, ...twitchVideos, ...rumbleVideos]
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
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
          loadFeed(updated, kickChannels, twitchChannels, rumbleChannels)
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
        if (platform === 'kick') { setKickChannels(updated); setter(''); loadFeed(youtubeChannels, updated, twitchChannels, rumbleChannels) }
        if (platform === 'twitch') { setTwitchChannels(updated); setter(''); loadFeed(youtubeChannels, kickChannels, updated, rumbleChannels) }
        if (platform === 'rumble') { setRumbleChannels(updated); setter(''); loadFeed(youtubeChannels, kickChannels, twitchChannels, updated) }
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
      loadFeed(updated, kickChannels, twitchChannels, rumbleChannels)
    } else {
      const current = loadFromStorage(platform)
      const updated = current.filter(c => c !== key)
      saveToStorage(platform, updated)
      if (platform === 'kick') { setKickChannels(updated); loadFeed(youtubeChannels, updated, twitchChannels, rumbleChannels) }
      if (platform === 'twitch') { setTwitchChannels(updated); loadFeed(youtubeChannels, kickChannels, updated, rumbleChannels) }
      if (platform === 'rumble') { setRumbleChannels(updated); loadFeed(youtubeChannels, kickChannels, twitchChannels, updated) }
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
  const channels = ['all', ...Array.from(new Set(platformFiltered.map(v => v.channelName))).sort()]
  const filtered = activeChannel === 'all' ? platformFiltered : platformFiltered.filter(v => v.channelName === activeChannel)
  const liveVideos = filtered.filter(v => v.isLive)
  const vodVideos = filtered.filter(v => !v.isLive)

  const switchPlatform = (platform, toggleManager, ...closeManagers) => {
    if (activePlatform !== platform) setActiveChannel('all')
    setActivePlatform(platform)
    toggleManager(m => !m)
    closeManagers.forEach(fn => fn(false))
  }

  return (
    <div className="feed-layout">
      <header className="feed-header">
        <div className="feed-title">▶ StreamFeed</div>
        <div className="header-actions">
          <button
            className={`platform-mgr-btn all-btn ${activePlatform === 'all' ? 'all-btn-active' : ''}`}
            onClick={() => { setActivePlatform('all'); setActiveChannel('all'); setShowYoutubeManager(false); setShowKickManager(false); setShowTwitchManager(false); setShowRumbleManager(false) }}
          >
            All
          </button>
          <button
            className={`platform-mgr-btn youtube-color ${activePlatform !== 'all' && activePlatform !== 'youtube' ? 'platform-inactive' : ''}`}
            onClick={() => switchPlatform('youtube', setShowYoutubeManager, setShowKickManager, setShowTwitchManager, setShowRumbleManager)}
          >
            YouTube
          </button>
          <button
            className={`platform-mgr-btn rumble-color ${activePlatform !== 'all' && activePlatform !== 'rumble' ? 'platform-inactive' : ''}`}
            onClick={() => switchPlatform('rumble', setShowRumbleManager, setShowKickManager, setShowTwitchManager, setShowYoutubeManager)}
          >
            Rumble
          </button>
          <button
            className={`platform-mgr-btn twitch-color ${activePlatform !== 'all' && activePlatform !== 'twitch' ? 'platform-inactive' : ''}`}
            onClick={() => switchPlatform('twitch', setShowTwitchManager, setShowKickManager, setShowRumbleManager, setShowYoutubeManager)}
          >
            Twitch
          </button>
          <button
            className={`platform-mgr-btn kick-color ${activePlatform !== 'all' && activePlatform !== 'kick' ? 'platform-inactive' : ''}`}
            onClick={() => switchPlatform('kick', setShowKickManager, setShowTwitchManager, setShowRumbleManager, setShowYoutubeManager)}
          >
            Kick
          </button>
        </div>
      </header>

      {showYoutubeManager && (
        <ChannelManager
          title="YouTube Channels" platform="youtube"
          list={youtubeChannels} newVal={newYoutubeChannel} setNewVal={setNewYoutubeChannel}
          color="#ff0000" onAdd={addChannel} onRemove={removeChannel}
          getLabel={ch => ch.name} getKey={ch => ch.id}
          adding={addingYoutube} addError={youtubeAddError}
        />
      )}
      {showRumbleManager && (
        <ChannelManager
          title="Rumble Channels" platform="rumble"
          list={rumbleChannels} newVal={newRumbleChannel} setNewVal={setNewRumbleChannel}
          color="#85c742" onAdd={addChannel} onRemove={removeChannel}
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

      {!loading && videos.length > 0 && (
        <div className="filter-bar">
          {channels.map(ch => (
            <button
              key={ch}
              className={`filter-pill ${activeChannel === ch ? 'active' : ''}`}
              onClick={() => setActiveChannel(ch)}
            >
              {ch === 'all' ? 'All channels' : ch}
            </button>
          ))}
        </div>
      )}

      <div className="feed-body">
        <main className="feed-main">
          {loading && <div className="state-msg">Loading your feed...</div>}
          {error && <div className="state-msg error">{error}</div>}
          {!loading && !error && filtered.length === 0 && (
            <div className="state-msg">No videos yet — add some channels above.</div>
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
