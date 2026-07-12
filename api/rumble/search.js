const axios = require('axios');
const setCors = require('../_cors');

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json([]);

  const rssHeaders = { 'User-Agent': 'FeedReader/1.0', 'Accept': 'application/rss+xml, application/xml, */*' };

  try {
    const r = await axios.get(`https://rumble.com/search/channel.rss?q=${encodeURIComponent(q)}`, {
      headers: rssHeaders, timeout: 8000, validateStatus: () => true,
    });
    if (r.status === 200 && (r.data.includes('<rss') || r.data.includes('<feed') || r.data.includes('<item'))) {
      const results = [];
      const seen = new Set();
      const items = [...r.data.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1]);
      for (const item of items.slice(0, 10)) {
        const link = item.match(/<link>([^<]+)<\/link>/)?.[1] || '';
        const slugMatch = link.match(/rumble\.com\/c\/([^/?#\s]+)/);
        if (!slugMatch) continue;
        const slug = slugMatch[1];
        if (seen.has(slug)) continue;
        seen.add(slug);
        const titleMatch = item.match(/<title><!\[CDATA\[([^\]]*)\]\]><\/title>|<title>([^<]*)<\/title>/);
        const name = (titleMatch?.[1] || titleMatch?.[2] || slug).trim();
        const thumbnail = item.match(/<media:thumbnail[^>]+url="([^"]+)"/)?.[1] || null;
        results.push({ slug, name, thumbnail });
      }
      if (results.length > 0) return res.json(results);
    }
  } catch {}

  res.json([]);
};
