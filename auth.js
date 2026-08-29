// netlify/functions/_lib/auth.js
// Verifies a Google ID token, and checks Stripe directly for an active
// subscription on that email. Stripe itself is the source of truth for
// "who has Plus" — no separate database, so it can't fall out of sync
// (a cancelled subscription correctly stops counting as Plus).

async function verifyGoogleToken(idToken) {
  if (!idToken) return null;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('MISSING_GOOGLE_CLIENT_ID');

  const response = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken));
  if (!response.ok) return null;
  const payload = await response.json();

  if (payload.aud !== clientId) return null;
  if (payload.exp && Number(payload.exp) * 1000 < Date.now()) return null;

  return { id: payload.sub, email: payload.email || null };
}

async function hasActiveSubscription(email) {
  if (!email) return false;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('MISSING_STRIPE_SECRET_KEY');

  const custRes = await fetch(
    'https://api.stripe.com/v1/customers?email=' + encodeURIComponent(email) + '&limit=1',
    { headers: { 'Authorization': 'Bearer ' + secretKey } }
  );
  const custData = await custRes.json();
  if (!custRes.ok || !custData.data || custData.data.length === 0) return false;

  const subRes = await fetch(
    'https://api.stripe.com/v1/subscriptions?customer=' + encodeURIComponent(custData.data[0].id) + '&status=active&limit=1',
    { headers: { 'Authorization': 'Bearer ' + secretKey } }
  );
  const subData = await subRes.json();
  return !!(subRes.ok && subData.data && subData.data.length > 0);
}

function getBearerToken(event) {
  const header = event.headers && (event.headers.authorization || event.headers.Authorization);
  if (!header || header.indexOf('Bearer ') !== 0) return null;
  return header.slice('Bearer '.length).trim();
}

module.exports = { verifyGoogleToken, hasActiveSubscription, getBearerToken };
