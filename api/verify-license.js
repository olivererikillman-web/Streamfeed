const jwt = require('jsonwebtoken');
const setCors = require('./_cors');

const LICENSE_SECRET = process.env.LICENSE_SECRET || 'dev-secret';

module.exports = (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { key } = req.query;
  if (!key) return res.json({ valid: false });
  try {
    jwt.verify(key, LICENSE_SECRET);
    res.json({ valid: true });
  } catch {
    res.json({ valid: false });
  }
};
