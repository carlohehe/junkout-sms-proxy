export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { recipient, message } = req.body;
    if (!recipient || !message) return res.status(400).json({ error: 'recipient and message are required' });

    const response = await fetch('https://app.philsms.com/api/v3/sms/send', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer 3230|owsBRBsHBAQEd4hWoHMCqnjcdyDq9zAtlAdy5X391e6032ca',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        sender_id: 'PhilSMS',
        recipient,
        message
      })
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
