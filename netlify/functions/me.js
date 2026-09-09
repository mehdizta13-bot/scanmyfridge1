// netlify/functions/me.js
// Returns the signed-in person's email and real Plus status, checked live
// against Stripe every time (see _lib/auth.js).

const { verifyGoogleToken, hasActiveSubscription, getBearerToken } = require('./_lib/auth');

exports.handler = async function (event) {
  if (event.httpMethod !== 'GET') {
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

  let isUpgraded = false;
  try { isUpgraded = await hasActiveSubscription(user.email); } catch (err) { /* leave false */ }

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: user.email, isUpgraded })
  };
};
