// netlify/functions/scan.js
// Expects: POST { image: <base64>, prompt: <string> }, Authorization: Bearer <Google ID token>
// Returns: { result: <the meal-plan JSON, as an object> }

const { verifyGoogleToken, getBearerToken } = require('./_lib/auth');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: "Server is missing ANTHROPIC_API_KEY. Add it in Netlify environment variables and redeploy." }) };
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

  let payload;
  try { payload = JSON.parse(event.body); } catch (e) {
    return { statusCode: 400, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'Invalid request body.' }) };
  }
  const { image, prompt } = payload || {};
  if (!image || !prompt) {
    return { statusCode: 400, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'Missing image or prompt.' }) };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 3200,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return { statusCode: response.status, headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: data.error ? data.error.message : 'Anthropic API error' }) };
    }

    const textBlock = (data.content || []).map(function (b) { return b.type === 'text' ? b.text : ''; }).join('\n');
    let cleaned = textBlock.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1) cleaned = cleaned.slice(start, end + 1);

    let result;
    try { result = JSON.parse(cleaned); } catch (e) {
      return { statusCode: 502, headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'AI response was not valid JSON — try scanning again.' }) };
    }

    return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ result: result }) };
  } catch (err) {
    return { statusCode: 502, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Could not reach the Anthropic API.' }) };
  }
};
