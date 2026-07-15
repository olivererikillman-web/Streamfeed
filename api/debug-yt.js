const axios = require('axios');
const setCors = require('./_cors');

module.exports = async (req, res) => {
  setCors(req, res);
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return res.json({ error: 'No YOUTUBE_API_KEY set' });

  // Test oEmbed with /shorts/ URL: real Shorts → 200, regular videos → error
  const testVideos = [
    { id: 'dQw4w9WgXcQ', label: 'Rick Roll (regular landscape video)' },
    { id: 'V-_O7nl0Ii0', label: 'Nice Ocean Waves (Short?)' },
  ];
  try {
    const results = await Promise.all(testVideos.map(async ({ id, label }) => {
      try {
        const r = await axios.get('https://www.youtube.com/oembed', {
          params: { url: `https://www.youtube.com/shorts/${id}`, format: 'json' },
          timeout: 5000,
          validateStatus: () => true,
        });
        return { id, label, oembedStatus: r.status, wouldBeFilteredAsShort: r.status === 200 };
      } catch (e) {
        return { id, label, oembedError: e.message, wouldBeFilteredAsShort: false };
      }
    }));
    res.json({ results });
  } catch (e) {
    res.json({ error: e.message });
  }
};
