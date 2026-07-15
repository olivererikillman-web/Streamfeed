const axios = require('axios');
const setCors = require('./_cors');

async function getJpegDims(url) {
  try {
    const r = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: { Range: 'bytes=0-8192' },
      timeout: 5000,
      validateStatus: () => true,
    });
    if (r.status === 404) return { status: 404 };
    const buf = Buffer.from(r.data);
    for (let i = 0; i < buf.length - 9; i++) {
      if (buf[i] === 0xFF && (buf[i+1] === 0xC0 || buf[i+1] === 0xC1 || buf[i+1] === 0xC2)) {
        const h = (buf[i+5] << 8) | buf[i+6];
        const w = (buf[i+7] << 8) | buf[i+8];
        return { status: r.status, width: w, height: h, isPortrait: h > w };
      }
    }
    return { status: r.status, error: 'SOF not found' };
  } catch (e) {
    return { error: e.message };
  }
}

module.exports = async (req, res) => {
  setCors(req, res);

  const testId = req.query.id || 'kK9xN5kbY0c'; // default: known Haraldbaldr Short
  const base = `https://i.ytimg.com/vi/${testId}`;

  const [maxres, oar, hq2, hqdefault] = await Promise.all([
    getJpegDims(`${base}/maxresdefault.jpg`),
    getJpegDims(`${base}/oardefault.jpg`),
    getJpegDims(`${base}/hq2.jpg`),
    getJpegDims(`${base}/hqdefault.jpg`),
  ]);

  res.json({ id: testId, maxresdefault: maxres, oardefault: oar, hq2, hqdefault });
};
