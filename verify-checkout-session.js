// netlify/functions/verify-checkout-session.js
//
// After Stripe redirects a customer back to the site, the browser calls this
// with the session_id Stripe gave it. This function asks Stripe directly
// whether that session really was paid — so unlocking "Plus" depends on
// Stripe's own answer, not anything the browser could fake by editing a URL.

exports.handler = async function (event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: "Server is missing STRIPE_SECRET_KEY." })
    };
  }

  const sessionId = event.queryStringParameters && event.queryStringParameters.session_id;
  if (!sessionId) {
    return {
      statusCode: 400,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Missing session_id' })
    };
  }

  try {
    const response = await fetch(
      'https://api.stripe.com/v1/checkout/sessions/' + encodeURIComponent(sessionId),
      { headers: { 'Authorization': 'Bearer ' + secretKey } }
    );
    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: data.error ? data.error.message : 'Stripe rejected the request.' })
      };
    }

    const verified = data.payment_status === 'paid' || data.status === 'complete';

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ verified: !!verified })
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Could not reach Stripe.' })
    };
  }
};
