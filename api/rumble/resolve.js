const axios = require('axios');
const setCors = require('../_cors');

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  let { username } = req.body || {};
  if (!username) return res.status(400).json({ error: 'username required' });

  const urlMatch = username.match(/rumble\.com\/(?:c|user)\/([^/?#\s]+)/i);
  const slug = (urlMatch ? urlMatch[1] : username).trim().toLowerCase();
  const rssHeaders = { 'User-Agent': 'FeedReader/1.0', 'Accept': 'application/rss+xml, application/xml, */*' };

  try {
    const rssRes = await axios.get(`https://rumble.com/c/${slug}.rss`, {
      headers: rssHeaders, timeout: 8000, validateStatus: s => s < 500,
    });
    if (rssRes.status === 200 && (rssRes.data.includes('<rss') || rssRes.data.includes('<channel'))) {
      const titles = [...rssRes.data.matchAll(/<title><!\[CDATA\[([^\]]*)\]\]><\/title>|<title>([^<]*)<\/title>/g)];
      const name = (titles[0]?.[1] || titles[0]?.[2] || '').replace(/\s*[-|].*$/, '').trim();
      if (name && !name.toLowerCase().includes('just a moment')) {
        return res.json({ slug, name });
      }
    }
    if (rssRes.status === 404) return res.status(404).json({ error: 'Channel not found' });
  } catch {}

  res.json({ slug, name: slug });
};
