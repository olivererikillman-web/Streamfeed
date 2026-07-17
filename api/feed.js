const axios = require('axios');
const setCors = require('./_cors');

function uploadsPlaylistId(channelId) {
  return 'UU' + channelId.slice(2);
}

// Parse ISO 8601 duration string to seconds (e.g. PT1H2M3S)
function parseDuration(d) {
  if (!d) return 0;
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0);
}

// Fetch up to 30 recent uploads from a channel via the uploads playlist
async function fetchChannelVideos(channel, apiKey) {
  try {
    const r = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', {
      params: {
        part: 'snippet',
        playlistId: uploadsPlaylistId(channel.id),
        maxResults: 30,
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

// Batch-fetch durations for up to 50 video IDs in one API call (costs 1 quota unit)
async function fetchDurations(videoIds, apiKey) {
  try {
    const r = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: { part: 'contentDetails', id: videoIds.join(','), key: apiKey },
      timeout: 8000,
    });
    const map = {};
    for (const item of r.data.items || []) {
      map[item.id] = parseDuration(item.contentDetails?.duration);
    }
    return map;
  } catch (e) {
    console.error('Duration fetch error:', e.message);
    return {};
  }
}

// Check if a video is portrait (Short) by reading the oardefault.jpg binary header.
// Only called for videos ≤5 min, keeping the number of HTTP checks small.
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

  // Step 1: Fetch recent uploads from all channels in parallel (30 per channel)
  const channelResults = await Promise.allSettled(
    channels.map(ch => fetchChannelVideos(ch, apiKey))
  );
  const allVideos = channelResults
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);

  // Step 2: Batch-fetch durations (50 per API call — ~12 calls for 20 channels × 30 videos)
  const allIds = allVideos.map(v => v.videoId);
  const batches = [];
  for (let i = 0; i < allIds.length; i += 50) batches.push(allIds.slice(i, i + 50));
  const durationMaps = await Promise.all(batches.map(b => fetchDurations(b, apiKey)));
  const durations = Object.assign({}, ...durationMaps);

  // Step 3: Videos >5 min are definitely not Shorts — keep without further checks.
  //         Videos ≤5 min need portrait detection via oardefault.jpg.
  const SHORTS_MAX = 300;
  const definitelyRegular = allVideos.filter(v => (durations[v.videoId] || 0) > SHORTS_MAX);
  const maybeShorts = allVideos.filter(v => (durations[v.videoId] || 0) <= SHORTS_MAX);

  // Step 4: Portrait-check only the short candidates (typically <10% of all videos)
  const portraitChecks = await Promise.allSettled(
    maybeShorts.map(async v => ({ ...v, portrait: await isPortraitVideo(v.videoId) }))
  );
  const confirmedRegular = portraitChecks
    .filter(r => r.status === 'fulfilled' && !r.value.portrait)
    .map(r => r.value);

  // Step 5: Merge, sort by date, cap at 5 per channel
  const combined = [...definitelyRegular, ...confirmedRegular]
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  const byChannel = new Map();
  for (const v of combined) {
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
