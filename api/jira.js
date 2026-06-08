// Vercel serverless function — Jira API proxy
// Solves CORS: browser calls /api/jira, this function calls Jira server-side.
// The x-jira-auth header carries the base64(email:token) credential.
//
// Modes:
//   ?ticket=COCA-123        → single issue (summary,status,assignee,dates,subtasks,…)
//   ?jql=<JQL>&fields=a,b   → enhanced search (/rest/api/3/search/jql), used for epic children
//   ?path=<rest-path>       → arbitrary /rest/api/3/<path> passthrough
//   (none)                  → connection test (/myself)

const ISSUE_FIELDS = 'summary,status,assignee,priority,issuetype,duedate,customfield_10015,subtasks,parent,comment';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'x-jira-auth, content-type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { ticket, baseUrl, path, jql, fields, maxResults, create } = req.query;
  const auth = req.headers['x-jira-auth'];

  if (!baseUrl || !auth) {
    return res.status(400).json({ error: 'Missing baseUrl or auth header' });
  }

  // ── POST: create an issue (e.g. a testing sub-task) ──
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    try {
      const resp = await fetch(`${baseUrl}/rest/api/3/issue`, {
        method: 'POST',
        headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
      const text = await resp.text();
      let data; try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }
      return res.status(resp.status).json(data);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // Build the Jira REST URL
  let jiraUrl;
  if (jql) {
    // Enhanced JQL search (used for epic children). Returns issues[] with requested fields.
    const f = fields || ISSUE_FIELDS;
    const mr = maxResults || '100';
    const params = new URLSearchParams();
    params.set('jql', jql);
    params.set('fields', f);
    params.set('maxResults', mr);
    jiraUrl = `${baseUrl}/rest/api/3/search/jql?${params.toString()}`;
  } else if (path) {
    jiraUrl = `${baseUrl}/rest/api/3/${path}`;
  } else if (ticket) {
    jiraUrl = `${baseUrl}/rest/api/3/issue/${ticket}?fields=${encodeURIComponent(ISSUE_FIELDS)}`;
  } else {
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
    try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }

    res.status(resp.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
