const axios = require('axios');
const setCors = require('./_cors');

// Uploads playlist ID = 'UU' + channelId without 'UC' prefix (no API call needed)
function uploadsPlaylistId(channelId) {
  return 'UU' + channelId.slice(2);
}

// Fetch up to 50 recent uploads from a channel via the uploads playlist
async function fetchChannelVideos(channel, apiKey) {
  try {
    const r = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', {
      params: {
        part: 'snippet',
        playlistId: uploadsPlaylistId(channel.id),
        maxResults: 50,
        key: apiKey,
      },
      timeout: 8000,
    });
    return (r.data.items || [])
      .map(item => {
        const videoId = item.snippet?.resourceId?.videoId;
        const title = item.snippet?.title || '';
        if (!videoId || title === 'Private video' || title === 'Deleted video') return null;
        const thumbs = item.snippet?.thumbnails;
        const thumbnail =
          thumbs?.standard?.url || thumbs?.high?.url || thumbs?.medium?.url ||
          `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
        return {
          videoId,
          title,
          publishedAt: item.snippet?.publishedAt,
          thumbnail,
          channelName: channel.name,
          channelId: channel.id,
        };
      })
      .filter(Boolean);
  } catch (e) {
    console.error(`Playlist fetch error for ${channel.name}:`, e.message);
    return [];
  }
}

// Check if a video is portrait (Short) by reading the oardefault.jpg binary header
async function isPortraitVideo(videoId) {
  try {
    const r = await axios.get(`https://i.ytimg.com/vi/${videoId}/oardefault.jpg`, {
      responseType: 'arraybuffer',
      headers: { Range: 'bytes=0-8192' },
      timeout: 4000,
      validateStatus: () => true,
    });
    const buf = Buffer.from(r.data);
    for (let i = 0; i < buf.length - 9; i++) {
      if (buf[i] === 0xFF && (buf[i + 1] === 0xC0 || buf[i + 1] === 0xC1 || buf[i + 1] === 0xC2)) {
        const h = (buf[i + 5] << 8) | buf[i + 6];
        const w = (buf[i + 7] << 8) | buf[i + 8];
        return h > w;
      }
    }
  } catch {}
  return false;
}

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.YOUTUBE_API_KEY;
  const ids = req.query.ids ? req.query.ids.split(',').filter(Boolean) : [];
  const names = req.query.names ? req.query.names.split(',') : [];
  if (ids.length === 0 || !apiKey) return res.json([]);

  const channels = ids.map((id, i) => ({ id, name: decodeURIComponent(names[i] || id) }));

  // Fetch recent uploads from all channels in parallel (up to 50 per channel)
  const channelResults = await Promise.allSettled(
    channels.map(ch => fetchChannelVideos(ch, apiKey))
  );

  // Build per-channel video lists
  const channelVideos = new Map();
  for (let i = 0; i < channels.length; i++) {
    const result = channelResults[i];
    if (result.status === 'fulfilled' && result.value.length > 0) {
      channelVideos.set(channels[i].id, result.value);
    }
  }

  // Check portrait format for all videos in parallel
  const allVideos = [...channelVideos.values()].flat();
  const portraitChecks = await Promise.allSettled(
    allVideos.map(async v => ({ ...v, portrait: await isPortraitVideo(v.videoId) }))
  );

  // Group non-portrait videos by channel, take up to 5 per channel
  const byChannel = new Map();
  for (const result of portraitChecks) {
    if (result.status !== 'fulfilled' || result.value.portrait) continue;
    const v = result.value;
    if (!byChannel.has(v.channelId)) byChannel.set(v.channelId, []);
    const list = byChannel.get(v.channelId);
    if (list.length < 5) {
      list.push({
        videoId: v.videoId,
        title: v.title,
        channelName: v.channelName,
        channelId: v.channelId,
        thumbnail: v.thumbnail,
        publishedAt: v.publishedAt,
        url: `https://www.youtube.com/watch?v=${v.videoId}`,
        platform: 'youtube',
      });
    }
  }

  const videos = [...byChannel.values()].flat();
  videos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  res.json(videos);
};
