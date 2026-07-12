const jwt = require('jsonwebtoken');
const setCors = require('./_cors');

const LICENSE_SECRET = process.env.LICENSE_SECRET || 'dev-secret';

module.exports = (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  const license = jwt.sign({ trial: true }, LICENSE_SECRET, { expiresIn: '7d' });
  res.json({ license });
};
