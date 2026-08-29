// netlify/functions/create-checkout-session.js
//
// Starts a real Stripe Checkout session. The browser calls this, gets back a
// URL on Stripe's own secure, PCI-compliant checkout page, and redirects
// there. Card details are typed on Stripe's page, never on ours — this site
// never touches, sees, or stores a card number.

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;

  if (!secretKey || !priceId) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        error: "Server is missing STRIPE_SECRET_KEY or STRIPE_PRICE_ID. Add both in Netlify's environment variables, then redeploy."
      })
    };
  }

  const origin = event.headers.origin || ('https://' + event.headers.host);

  const params = new URLSearchParams();
  params.append('mode', 'subscription');
  params.append('line_items[0][price]', priceId);
  params.append('line_items[0][quantity]', '1');
  params.append('success_url', origin + '/?checkout=success&session_id={CHECKOUT_SESSION_ID}');
  params.append('cancel_url', origin + '/?checkout=cancelled');

  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + secretKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: data.error ? data.error.message : 'Stripe rejected the request.' })
      };
    }

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: data.url })
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Could not reach Stripe.' })
    };
  }
};
