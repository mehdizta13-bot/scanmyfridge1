// netlify/functions/stripe-portal.js
// POST, Authorization: Bearer <Google ID token>
// Returns: { url } — Stripe's own billing portal, where a customer can
// cancel, update payment method, view invoices. Real Stripe UI, not ours.

const { verifyGoogleToken, getBearerToken } = require('./_lib/auth');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
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
      body: JSON.stringify({ error: 'Server is missing GOOGLE_CLIENT_ID.' }) };
  }
  if (!user) {
    return { statusCode: 401, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Please sign in first.' }) };
  }

  try {
    const custRes = await fetch(
      'https://api.stripe.com/v1/customers?email=' + encodeURIComponent(user.email) + '&limit=1',
      { headers: { 'Authorization': 'Bearer ' + secretKey } }
    );
    const custData = await custRes.json();
    if (!custRes.ok || !custData.data || custData.data.length === 0) {
      return { statusCode: 404, headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'No subscription found for this account.' }) };
    }

    const origin = event.headers.origin || ('https://' + event.headers.host);
    const params = new URLSearchParams();
    params.append('customer', custData.data[0].id);
    params.append('return_url', origin + '/');

    const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + secretKey, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    const portalData = await portalRes.json();
    if (!portalRes.ok) {
      return { statusCode: portalRes.status, headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: portalData.error ? portalData.error.message : 'Stripe rejected the request.' }) };
    }

    return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: portalData.url }) };
  } catch (err) {
    return { statusCode: 502, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Could not reach Stripe.' }) };
  }
};
