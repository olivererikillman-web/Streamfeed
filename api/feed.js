const axios = require('axios');
const setCors = require('./_cors');

const YT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

function parseDurationSeconds(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 9999;
  return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0);
}

async function getShortVideoIds(videoIds) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey || videoIds.length === 0) return new Set();
  const shortIds = new Set();
  const ambiguous = []; // 61-180s: could be Shorts (YT Shorts now up to 3 min)

  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    try {
      const r = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
        params: { part: 'contentDetails', id: batch.join(','), key: apiKey },
        timeout: 6000,
      });
      for (const item of r.data.items || []) {
        const secs = parseDurationSeconds(item.contentDetails?.duration || '');
        if (secs <= 60) shortIds.add(item.id);
        else if (secs <= 180) ambiguous.push(item.id);
        // > 180s: not a Short
      }
    } catch (e) {
      console.error('YouTube API error:', e.message);
    }
  }

  // oEmbed check for 61-180s videos: /shorts/{id} returns 200 for real Shorts,
  // error for regular landscape videos
  if (ambiguous.length > 0) {
    const checks = await Promise.allSettled(
      ambiguous.map(async id => {
        try {
          const r = await axios.get('https://www.youtube.com/oembed', {
            params: { url: `https://www.youtube.com/shorts/${id}`, format: 'json' },
            timeout: 4000,
            validateStatus: () => true,
          });
          return { id, isShort: r.status === 200 };
        } catch {
          return { id, isShort: false };
        }
      })
    );
    for (const result of checks) {
      if (result.status === 'fulfilled' && result.value.isShort) {
        shortIds.add(result.value.id);
      }
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
