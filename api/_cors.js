const ALLOWED = [
  'https://subfeed.xyz',
  'https://www.subfeed.xyz',
  'https://streamfeed-rho.vercel.app',
  'http://localhost:5173',
];

module.exports = function setCors(req, res) {
  const origin = req.headers.origin;
  if (!origin || ALLOWED.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
};
