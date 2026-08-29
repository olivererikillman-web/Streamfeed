import './VideoCard.css'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
      <circle cx="12" cy="12" r="9"/>
      <polyline points="12 7 12 12 15 15"/>
    </svg>
  )
}

export default function VideoCard({ video, onWatchLater, inWatchLater, onEmbed }) {
  if (onEmbed) {
    return (
      <div className="video-card" onClick={onEmbed} style={{ cursor: 'pointer' }}>
        <div className="thumbnail-wrap">
          <img src={video.thumbnail} alt={video.title} loading="lazy" referrerPolicy="no-referrer" />
          {video.isLive
            ? <div className="live-badge">LIVE</div>
            : <div className="play-overlay">▶</div>
          }
          {onWatchLater && (
            <button
              className={`watch-later-btn${inWatchLater ? ' added' : ''}`}
              title={inWatchLater ? 'Saved to Watch Later' : 'Save to Watch Later'}
              onClick={e => {
                e.preventDefault()
                e.stopPropagation()
                if (!inWatchLater) onWatchLater(video)
              }}
            >
              <ClockIcon />
            </button>
          )}
          {video.platform === 'youtube' && <div className="platform-badge youtube">YT</div>}
          {video.platform === 'kick' && <div className="platform-badge kick">Kick</div>}
          {video.platform === 'twitch' && <div className="platform-badge twitch">Twitch</div>}
          {video.isLive && video.viewers != null && (
            <div className="viewer-count">{video.viewers.toLocaleString()} viewers</div>
          )}
        </div>
        <div className="video-info">
          <p className="video-title">{video.title}</p>
          <div className="video-meta">
            <span className="channel-name">{video.channelName}</span>
            <span className="video-time">{video.isLive ? 'Live now' : timeAgo(video.publishedAt)}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <a href={video.url} target="_blank" rel="noopener noreferrer" className="video-card">
      <div className="thumbnail-wrap">
        <img src={video.thumbnail} alt={video.title} loading="lazy" referrerPolicy="no-referrer" />
        {video.isLive
          ? <div className="live-badge">LIVE</div>
          : <div className="play-overlay">▶</div>
        }
        {onWatchLater && (
          <button
            className={`watch-later-btn${inWatchLater ? ' added' : ''}`}
            title={inWatchLater ? 'Saved to Watch Later' : 'Save to Watch Later'}
            onClick={e => {
              e.preventDefault()
              e.stopPropagation()
              if (!inWatchLater) onWatchLater(video)
            }}
          >
            <ClockIcon />
          </button>
        )}
        {video.platform === 'youtube' && <div className="platform-badge youtube">YT</div>}
        {video.platform === 'kick' && <div className="platform-badge kick">Kick</div>}
        {video.platform === 'twitch' && <div className="platform-badge twitch">Twitch</div>}
        {video.isLive && video.viewers != null && (
          <div className="viewer-count">{video.viewers.toLocaleString()} viewers</div>
        )}
      </div>
      <div className="video-info">
        <p className="video-title">{video.title}</p>
        <div className="video-meta">
          <span className="channel-name">{video.channelName}</span>
          <span className="video-time">{video.isLive ? 'Live now' : timeAgo(video.publishedAt)}</span>
        </div>
      </div>
    </a>
  )
}
