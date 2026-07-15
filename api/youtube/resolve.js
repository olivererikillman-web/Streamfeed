const axios = require('axios');
const setCors = require('../_cors');

const YT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

function extractChannelInfo(html, fallbackName) {
  const channelId =
    html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[^"]+)"/)?.[1] ||
    html.match(/"channelId":"(UC[^"]+)"/)?.[1] ||
    html.match(/"externalId":"(UC[^"]+)"/)?.[1];
  if (!channelId) return null;
  const name =
    html.match(/<title>([^<]+) - YouTube<\/title>/)?.[1]?.trim() ||
    html.match(/"title":"([^"]+)","description"/)?.[1] ||
    fallbackName;
  return { id: channelId, name };
}

async function resolveYouTubeChannel(handle) {
  const clean = handle.replace(/^@/, '').trim();
  const urls = [
    `https://www.youtube.com/@${clean}`,
    `https://www.youtube.com/c/${clean}`,
    `https://www.youtube.com/user/${clean}`,
  ];
  // Fetch all in parallel with a 7s timeout each
  const results = await Promise.allSettled(
    urls.map(url => axios.get(url, { headers: YT_HEADERS, timeout: 7000, validateStatus: s => s < 500 }))
  );
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const r = result.value;
    if (r.status === 404) continue;
    const info = extractChannelInfo(r.data, clean);
    if (info) return info;
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
