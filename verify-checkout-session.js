// netlify/functions/verify-checkout-session.js
// Confirms with Stripe that a session was really paid AND belongs to the
// person currently signed in (stops reusing someone else's payment link).
// Nothing is written anywhere — the Stripe subscription itself is now the
// durable "this person has Plus" record, checked fresh via _lib/auth.js.

const { verifyGoogleToken, getBearerToken } = require('./_lib/auth');

exports.handler = async function (event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return { statusCode: 500, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Server is missing STRIPE_SECRET_KEY.' }) };
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
      body: JSON.stringify({ error: 'Please sign in to confirm your upgrade.' }) };
  }

  const sessionId = event.queryStringParameters && event.queryStringParameters.session_id;
  if (!sessionId) {
    return { statusCode: 400, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Missing session_id' }) };
  }

  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions/' + encodeURIComponent(sessionId),
      { headers: { 'Authorization': 'Bearer ' + secretKey } });
    const data = await response.json();
    if (!response.ok) {
      return { statusCode: response.status, headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: data.error ? data.error.message : 'Stripe rejected the request.' }) };
    }

    const paid = data.payment_status === 'paid' || data.status === 'complete';
    const belongsToCurrentUser = data.client_reference_id === user.id;
    const verified = paid && belongsToCurrentUser;

    return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ verified: !!verified }) };
  } catch (err) {
    return { statusCode: 502, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Could not reach Stripe.' }) };
  }
};
