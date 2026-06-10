require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const Stripe = require('stripe');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const LICENSE_SECRET = process.env.LICENSE_SECRET || 'dev-secret-change-in-production';
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || 'price_1TfQ3XHPPXuWYOtWTTsoXu9k';
const CLIENT_URL = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json());

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

// --- Paywall ---

// Create Stripe Checkout session
app.post('/api/checkout', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      mode: 'payment',
      success_url: `${CLIENT_URL}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: CLIENT_URL,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Activate license after successful payment
app.get('/api/activate', async (req, res) => {
  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ error: 'session_id required' });
  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== 'paid') return res.status(402).json({ error: 'Payment not completed' });
    const license = jwt.sign({ paid: true, session: session_id }, LICENSE_SECRET);
    res.json({ license });
  } catch (err) {
    console.error('Activate error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Verify a license key
app.get('/api/verify-license', (req, res) => {
  const { key } = req.query;
  if (!key) return res.json({ valid: false });
  try {
    jwt.verify(key, LICENSE_SECRET);
    res.json({ valid: true });
  } catch {
    res.json({ valid: false });
  }
});

// --- YouTube: resolve handle → { id, name } ---
app.post('/api/youtube/resolve', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'username required' });
  try {
    const resolved = await resolveYouTubeChannel(username);
    res.json(resolved);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

async function isYouTubeShort(videoId) {
  try {
    const r = await axios.get(`https://www.youtube.com/shorts/${videoId}`, {
      headers: { 'User-Agent': 'curl/7.68.0' },
      timeout: 5000,
      maxRedirects: 0,
      validateStatus: () => true,
    });
    return r.status === 200;
  } catch {
    return false;
  }
}

// --- YouTube feed ---
// Query params: ids=UCxxx,UCyyy  names=Name1,Name2
app.get('/api/feed', async (req, res) => {
  const ids = req.query.ids ? req.query.ids.split(',').filter(Boolean) : [];
  const names = req.query.names ? req.query.names.split(',') : [];
  if (ids.length === 0) return res.json([]);

  const channels = ids.map((id, i) => ({ id, name: decodeURIComponent(names[i] || id) }));

  const videoPromises = channels.map(async channel => {
    try {
      const r = await axios.get(`https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`, {
        headers: YT_HEADERS, timeout: 10000
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
          const thumbnail = entry.match(/<media:thumbnail url="([^"]+)"/)?.[1] ||
            `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
          return { videoId, title, channelName: channel.name, channelId: channel.id, thumbnail, publishedAt, url: `https://www.youtube.com/watch?v=${videoId}`, platform: 'youtube' };
        })
        .filter(v => v.videoId);

      const shortFlags = await Promise.all(entries.map(v => isYouTubeShort(v.videoId)));
      const nonShorts = entries.filter((_, i) => !shortFlags[i]);
      const toShow = nonShorts.length > 0 ? nonShorts : entries;
      return toShow.slice(0, 5);
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
});

// --- Rumble feed ---
// --- Rumble: resolve URL or slug → { slug, name } ---
app.post('/api/rumble/resolve', async (req, res) => {
  let { username } = req.body;
  if (!username) return res.status(400).json({ error: 'username required' });

  // Extract slug from URL if pasted (e.g. https://rumble.com/c/nickjfuentes)
  const urlMatch = username.match(/rumble\.com\/(?:c|user)\/([^/?#\s]+)/i);
  const slug = (urlMatch ? urlMatch[1] : username).trim().toLowerCase();

  const rssHeaders = { 'User-Agent': 'FeedReader/1.0', 'Accept': 'application/rss+xml, application/xml, */*' };

  // RSS bypasses Cloudflare — try it first to get the real channel name
  try {
    const rssRes = await axios.get(`https://rumble.com/c/${slug}.rss`, {
      headers: rssHeaders, timeout: 8000, validateStatus: s => s < 500
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

  // Fallback: HTML page (may be Cloudflare-blocked on Railway)
  try {
    const htmlHeaders = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    };
    const r = await axios.get(`https://rumble.com/c/${slug}`, { headers: htmlHeaders, timeout: 10000, validateStatus: s => s < 500 });
    if (r.status === 404) return res.status(404).json({ error: 'Channel not found' });
    const title = r.data.match(/<title>([^<]+)<\/title>/)?.[1] || '';
    const isCloudflare = title.toLowerCase().includes('just a moment') || r.data.includes('challenge-form');
    if (!isCloudflare) {
      return res.json({ slug, name: title.replace(/\s*[-|].*$/, '').trim() || slug });
    }
  } catch {}

  // Last resort: add with slug as name so the feed can still load
  res.json({ slug, name: slug });
});

// --- Rumble: search channels ---
app.get('/api/rumble/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json([]);

  const rssHeaders = { 'User-Agent': 'FeedReader/1.0', 'Accept': 'application/rss+xml, application/xml, */*' };

  try {
    // Try RSS search endpoint — avoids Cloudflare JS challenges
    const r = await axios.get(`https://rumble.com/search/channel.rss?q=${encodeURIComponent(q)}`, {
      headers: rssHeaders, timeout: 8000, validateStatus: () => true
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
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
