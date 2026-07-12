const Stripe = require('stripe');
const setCors = require('./_cors');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;
const CLIENT_URL = process.env.CLIENT_ORIGIN || 'https://subfeed.xyz';

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      mode: 'payment',
      success_url: `${CLIENT_URL}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: CLIENT_URL,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
