const Stripe = require('stripe');
const jwt = require('jsonwebtoken');
const setCors = require('./_cors');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const LICENSE_SECRET = process.env.LICENSE_SECRET || 'dev-secret';

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
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
};
