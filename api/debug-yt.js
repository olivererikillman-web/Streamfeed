const axios = require('axios');
const setCors = require('./_cors');

module.exports = async (req, res) => {
  setCors(req, res);
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return res.json({ error: 'No YOUTUBE_API_KEY set' });

  // Rick Roll = regular video, V-_O7nl0Ii0 = known Short
  const testIds = ['dQw4w9WgXcQ', 'V-_O7nl0Ii0'];
  try {
    const r = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: { part: 'contentDetails,snippet', id: testIds.join(','), key: apiKey },
      timeout: 8000,
    });
    const results = (r.data.items || []).map(item => ({
      id: item.id,
      title: item.snippet?.title,
      duration: item.contentDetails?.duration,
      thumbnails: item.snippet?.thumbnails,
    }));
    res.json({ results });
  } catch (e) {
    res.json({ error: e.message, response: e.response?.data });
  }
};
