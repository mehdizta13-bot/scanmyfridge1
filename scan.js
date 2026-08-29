// netlify/functions/scan.js
// Requires a signed-in Google account, then proxies to Anthropic with the
// server-held key. Free-scan counting happens in the browser (per account);
// this endpoint's security job is just requiring a real identity and never
// exposing the API key.

const { verifyGoogleToken, getBearerToken } = require('./_lib/auth');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: "Server is missing ANTHROPIC_API_KEY. In Netlify, go to Site configuration -> Environment variables, add ANTHROPIC_API_KEY with your key, then redeploy." }) };
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
      body: JSON.stringify({ error: 'Please sign in to scan your fridge.' }) };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: event.body
    });
    const text = await response.text();
    return { statusCode: response.status, headers: { 'content-type': 'application/json' }, body: text };
  } catch (err) {
    return { statusCode: 502, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Could not reach the Anthropic API.' }) };
  }
};
