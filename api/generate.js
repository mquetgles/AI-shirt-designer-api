module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, style, model, size, download } = req.body;

    const payload = {
      prompt: download
        ? prompt + ', transparent background, no shirt, isolated graphic only, print-ready artwork'
        : prompt,
      style: style || 'digital_illustration',
      model: model || 'recraftv3',
      size: size || '1024x1024'
    };

    const response = await fetch('https://external.api.recraft.ai/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.RECRAFT_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    console.log('Status:', response.status);
    console.log('Body:', text);
    return res.status(200).send(text);

  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
