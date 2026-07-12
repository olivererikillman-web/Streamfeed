const axios = require('axios');
const setCors = require('../_cors');

const YT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function resolveYouTubeChannel(handle) {
  const clean = handle.replace(/^@/, '').trim();
  const urls = [
    `https://www.youtube.com/@${clean}`,
    `https://www.youtube.com/c/${clean}`,
    `https://www.youtube.com/user/${clean}`,
  ];
  for (const url of urls) {
    try {
      const r = await axios.get(url, { headers: YT_HEADERS, timeout: 10000, validateStatus: s => s < 500 });
      if (r.status === 404) continue;
      const html = r.data;
      const canonicalMatch = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[^"]+)"/);
      if (!canonicalMatch) continue;
      const channelId = canonicalMatch[1];
      const nameMatch = html.match(/<title>([^<]+) - YouTube<\/title>/);
      const name = nameMatch ? nameMatch[1].trim() : clean;
      return { id: channelId, name };
    } catch (e) {
      console.error(`YouTube page fetch failed for ${url}:`, e.message);
    }
  }
  throw new Error(`Channel not found: ${handle}`);
}

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  const { username } = req.body || {};
  if (!username) return res.status(400).json({ error: 'username required' });
  try {
    const resolved = await resolveYouTubeChannel(username);
    res.json(resolved);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};
