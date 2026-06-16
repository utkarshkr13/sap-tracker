// Vercel serverless function — generic API proxy for the Mapping API Console.
// Lets the browser hit a client's API (any host) without CORS issues, passing
// through method, headers (incl. Basic auth) and body. Returns status + parsed body.
//
// POST /api/fetch  body: { url, method?, headers?, body? }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  let payload = req.body;
  if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch (e) { payload = {}; } }
  const { url, method = 'GET', headers = {}, body } = payload || {};

  if (!url || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: 'A valid http(s) url is required' });
  }

  // Build outbound request
  const opts = { method: (method || 'GET').toUpperCase(), headers: { 'Accept': 'application/json', ...headers } };
  if (opts.method !== 'GET' && opts.method !== 'HEAD' && body != null && body !== '') {
    opts.body = typeof body === 'string' ? body : JSON.stringify(body);
    if (!Object.keys(opts.headers).some(h => h.toLowerCase() === 'content-type')) {
      opts.headers['Content-Type'] = 'application/json';
    }
  }

  try {
    const resp = await fetch(url, opts);
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch (e) { data = { _raw: text }; }
    return res.status(200).json({ ok: resp.ok, status: resp.status, data });
  } catch (e) {
    return res.status(200).json({ ok: false, status: 0, error: e.message });
  }
}
