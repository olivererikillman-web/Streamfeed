const axios = require('axios');
const setCors = require('./_cors');

const YT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Fetch actual JPEG binary and read real image dimensions from header
async function getActualJpegDimensions(videoId) {
  try {
    // oardefault.jpg = "original aspect ratio" thumbnail — portrait for Shorts, landscape for regular videos
    const r = await axios.get(`https://i.ytimg.com/vi/${videoId}/oardefault.jpg`, {
      responseType: 'arraybuffer',
      headers: { Range: 'bytes=0-8192' },
      timeout: 4000,
      validateStatus: () => true,
    });
    const buf = Buffer.from(r.data);
    for (let i = 0; i < buf.length - 9; i++) {
      if (buf[i] === 0xFF && (buf[i+1] === 0xC0 || buf[i+1] === 0xC1 || buf[i+1] === 0xC2)) {
        const h = (buf[i+5] << 8) | buf[i+6];
        const w = (buf[i+7] << 8) | buf[i+8];
        return { width: w, height: h };
      }
    }
  } catch {}
  return null;
}

async function getShortVideoIds(videoIds) {
  if (videoIds.length === 0) return new Set();
  const shortIds = new Set();

  const results = await Promise.allSettled(
    videoIds.map(async id => {
      const dims = await getActualJpegDimensions(id);
      return { id, isPortrait: dims ? dims.height > dims.width : false };
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.isPortrait) {
      shortIds.add(result.value.id);
    }
  }
  return shortIds;
}

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ids = req.query.ids ? req.query.ids.split(',').filter(Boolean) : [];
  const names = req.query.names ? req.query.names.split(',') : [];
  if (ids.length === 0) return res.json([]);

  const channels = ids.map((id, i) => ({ id, name: decodeURIComponent(names[i] || id) }));

  // Fetch all RSS feeds in parallel
  const rssResults = await Promise.allSettled(
    channels.map(async channel => {
      try {
        const r = await axios.get(`https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`, {
          headers: YT_HEADERS, timeout: 10000,
        });
        const xml = r.data;
        return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
          .map(m => m[1])
          .slice(0, 15)
          .map(entry => {
            const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
            const title = entry.match(/<title>([^<]+)<\/title>/)?.[1]
              ?.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"') || '';
            const publishedAt = entry.match(/<published>([^<]+)<\/published>/)?.[1];
            const thumbnail = entry.match(/<media:thumbnail url="([^"]+)"/)?.[1] ||
              `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
            return { videoId, title, publishedAt, thumbnail, channelName: channel.name, channelId: channel.id };
          })
          .filter(v => v.videoId);
      } catch (e) {
        console.error(`RSS error for ${channel.name}:`, e.message);
        return [];
      }
    })
  );

  // Collect all videos grouped by channel
  const channelVideos = new Map();
  for (const result of rssResults) {
    if (result.status !== 'fulfilled') continue;
    for (const video of result.value) {
      if (!channelVideos.has(video.channelId)) channelVideos.set(video.channelId, []);
      channelVideos.get(video.channelId).push(video);
    }
  }

  // Get Short IDs via YouTube API (all videos in one/two calls)
  const allIds = [...channelVideos.values()].flat().map(v => v.videoId);
  const shortIds = await getShortVideoIds(allIds);

  // Take up to 5 non-Short videos per channel, then combine and sort
  const videos = [];
  for (const cVideos of channelVideos.values()) {
    const nonShorts = cVideos.filter(v => !shortIds.has(v.videoId)).slice(0, 5);
    for (const v of nonShorts) {
      videos.push({
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

  videos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  res.json(videos);
};
