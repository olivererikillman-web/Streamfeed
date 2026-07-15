const axios = require('axios');
const setCors = require('./_cors');

const YT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

function isShort(entry, title) {
  // Portrait thumbnail = Short (height > width in RSS feed)
  const thumbMatch = entry.match(/<media:thumbnail url="[^"]+" width="(\d+)" height="(\d+)"/);
  if (thumbMatch) {
    const w = parseInt(thumbMatch[1]);
    const h = parseInt(thumbMatch[2]);
    if (h > w) return true;
  }
  // #shorts hashtag in title or description (handles CDATA)
  const descRaw = entry.match(/<media:description>([\s\S]*?)<\/media:description>/)?.[1] || '';
  const desc = descRaw.replace(/<!\[CDATA\[/, '').replace(/\]\]>/, '');
  if (/#shorts/i.test(title) || /#shorts/i.test(desc)) return true;
  return false;
}

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ids = req.query.ids ? req.query.ids.split(',').filter(Boolean) : [];
  const names = req.query.names ? req.query.names.split(',') : [];
  if (ids.length === 0) return res.json([]);

  const channels = ids.map((id, i) => ({ id, name: decodeURIComponent(names[i] || id) }));

  const videoPromises = channels.map(async channel => {
    try {
      const r = await axios.get(`https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`, {
        headers: YT_HEADERS, timeout: 10000,
      });
      const xml = r.data;
      const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
        .map(m => m[1])
        .slice(0, 15)
        .map(entry => {
          const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
          const title = entry.match(/<title>([^<]+)<\/title>/)?.[1]
            ?.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
          const publishedAt = entry.match(/<published>([^<]+)<\/published>/)?.[1];
          const thumbUrl = entry.match(/<media:thumbnail url="([^"]+)"/)?.[1] ||
            `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
          if (isShort(entry, title || '')) return null;
          return {
            videoId, title,
            channelName: channel.name, channelId: channel.id,
            thumbnail: thumbUrl, publishedAt,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            platform: 'youtube',
          };
        })
        .filter(v => v && v.videoId);

      return entries.slice(0, 5);
    } catch (e) {
      console.error(`YouTube RSS error for ${channel.name}:`, e.message);
      return [];
    }
  });

  const results = await Promise.allSettled(videoPromises);
  const videos = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  res.json(videos);
};
