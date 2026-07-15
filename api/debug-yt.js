const axios = require('axios');
const setCors = require('./_cors');

function parseDurationSeconds(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 9999;
  return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0);
}

module.exports = async (req, res) => {
  setCors(req, res);
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return res.json({ error: 'No YOUTUBE_API_KEY set' });

  // Test #shorts tag detection — pass ?id=VIDEO_ID to test any video
  const testId = req.query.id || 'dQw4w9WgXcQ';
  try {
    const r = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: { part: 'contentDetails,snippet', id: testId, key: apiKey },
      timeout: 8000,
    });
    const item = r.data.items?.[0];
    if (!item) return res.json({ error: 'Video not found', id: testId });
    const title = item.snippet?.title || '';
    const desc = item.snippet?.description || '';
    const secs = parseDurationSeconds(item.contentDetails?.duration || '');
    const thumbs = item.snippet?.thumbnails;
    const t = thumbs?.maxres || thumbs?.high || thumbs?.medium;
    res.json({
      id: testId,
      title,
      duration: item.contentDetails?.duration,
      durationSeconds: secs,
      hasShortTag: /#shorts/i.test(title) || /#shorts/i.test(desc),
      thumbnailDimensions: t ? { width: t.width, height: t.height, isPortrait: t.height > t.width } : null,
      allThumbnails: thumbs,
      descriptionSnippet: desc.slice(0, 500),
    });
  } catch (e) {
    res.json({ error: e.message });
  }
};
