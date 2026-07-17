const axios = require('axios');
const setCors = require('./_cors');

const CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';

async function gql(query) {
  try {
    const r = await axios.post('https://gql.twitch.tv/gql', { query }, {
      headers: { 'Client-ID': CLIENT_ID, 'Content-Type': 'application/json' },
      timeout: 8000,
    });
    return r.data || {};
  } catch (e) {
    console.error('Twitch GQL error:', e.message);
    return {};
  }
}

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const logins = req.query.logins ? req.query.logins.split(',').filter(Boolean) : [];
  if (logins.length === 0) return res.json([]);

  // Single batched GQL request for all channels (server-side — no CORS/rate-limit issues)
  const streamQ = `{ ${logins.map((l, i) => `u${i}: user(login:"${l}") { displayName stream { title viewersCount createdAt previewImageURL(width:320,height:180) } }`).join(' ')} }`;
  const vodsQ   = `{ ${logins.map((l, i) => `u${i}: user(login:"${l}") { displayName videos(first:5,type:ARCHIVE) { edges { node { id title publishedAt previewThumbnailURL(width:320,height:180) } } } }`).join(' ')} }`;

  const [streamData, vodsData] = await Promise.all([gql(streamQ), gql(vodsQ)]);

  const items = [];
  logins.forEach((login, i) => {
    const user    = streamData?.data?.[`u${i}`];
    const vodUser = vodsData?.data?.[`u${i}`];
    const displayName = user?.displayName || vodUser?.displayName || login;

    if (user?.stream) {
      const s = user.stream;
      items.push({
        id: `twitch-live-${login}`,
        title: s.title || `${displayName} is live`,
        channelName: displayName,
        channelId: `twitch-${login}`,
        thumbnail: s.previewImageURL,
        publishedAt: s.createdAt,
        url: `https://twitch.tv/${login}`,
        platform: 'twitch', isLive: true, viewers: s.viewersCount,
      });
    }

    for (const { node: vod } of (vodUser?.videos?.edges || [])) {
      items.push({
        id: `twitch-vod-${vod.id}`,
        title: vod.title || 'Untitled VOD',
        channelName: displayName,
        channelId: `twitch-${login}`,
        thumbnail: vod.previewThumbnailURL,
        publishedAt: vod.publishedAt,
        url: `https://twitch.tv/videos/${vod.id}`,
        platform: 'twitch', isLive: false,
      });
    }
  });

  res.json(items);
};
