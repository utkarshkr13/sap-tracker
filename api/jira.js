// Vercel serverless function — Jira API proxy
// Solves CORS: browser calls /api/jira, this function calls Jira server-side.
// The x-jira-auth header carries the base64(email:token) credential.

export default async function handler(req, res) {
  // CORS headers so the browser can call this endpoint
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'x-jira-auth, content-type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { ticket, baseUrl, path } = req.query;
  const auth = req.headers['x-jira-auth'];

  if (!baseUrl || !auth) {
    return res.status(400).json({ error: 'Missing baseUrl or auth header' });
  }

  // Build the Jira REST URL
  let jiraUrl;
  if (path) {
    // Arbitrary sub-path: /rest/api/3/{path}
    jiraUrl = `${baseUrl}/rest/api/3/${path}`;
  } else if (ticket) {
    jiraUrl = `${baseUrl}/rest/api/3/issue/${ticket}?fields=summary,status,assignee,priority,issuetype,comment`;
  } else {
    // Connection test: fetch current user
    jiraUrl = `${baseUrl}/rest/api/3/myself`;
  }

  try {
    const resp = await fetch(jiraUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      },
    });

    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch(e) { data = { raw: text }; }

    res.status(resp.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
