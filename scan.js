// netlify/functions/scan.js
//
// This function runs on the server, never in the visitor's browser. It reads
// the Anthropic API key from an environment variable (ANTHROPIC_API_KEY) —
// that value is never included in any file that gets deployed, and never
// sent to the browser in any response. The browser sends the same
// { model, max_tokens, messages } body it always built; this function adds
// the key and forwards the request to Anthropic on the browser's behalf.

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        error: "Server is missing ANTHROPIC_API_KEY. In Netlify, go to Site configuration -> Environment variables, add ANTHROPIC_API_KEY with your key, then redeploy."
      })
    };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: event.body
    });

    const text = await response.text();

    return {
      statusCode: response.status,
      headers: { 'content-type': 'application/json' },
      body: text
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Could not reach the Anthropic API.' })
    };
  }
};
