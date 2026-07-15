const axios = require('axios');
const setCors = require('./_cors');

module.exports = async (req, res) => {
  setCors(req, res);
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return res.json({ error: 'No YOUTUBE_API_KEY set' });

  try {
    // Test with a known Short (dQw4w9WgXcW is not a short, but let's test API connectivity)
    const r = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        part: 'contentDetails',
        id: 'dQw4w9WgXcQ', // Rick Roll - a normal video
        key: apiKey,
      },
      timeout: 8000,
    });
    res.json({ status: r.status, data: r.data });
  } catch (e) {
    res.json({ error: e.message, response: e.response?.data });
  }
};
