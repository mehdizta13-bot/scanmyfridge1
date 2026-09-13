// netlify/functions/stripe-status.js
// Expects: POST, Authorization: Bearer <Google ID token>
// Returns: { subscribed: true|false } — checked live against Stripe.

const { verifyGoogleToken, hasActiveSubscription, getBearerToken } = require('./_lib/auth');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let user;
  try {
    user = await verifyGoogleToken(getBearerToken(event));
  } catch (err) {
    return { statusCode: 500, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Server is missing GOOGLE_CLIENT_ID. Add it in Netlify environment variables and redeploy.' }) };
  }
  if (!user) {
    return { statusCode: 401, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Not signed in, or the sign-in has expired.' }) };
  }

  let subscribed = false;
  try { subscribed = await hasActiveSubscription(user.email); } catch (err) { /* leave false */ }

  return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subscribed: subscribed }) };
};
