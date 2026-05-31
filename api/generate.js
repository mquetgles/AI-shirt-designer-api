module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { action, prompt, style, model, size, imageUrl } = req.body;

    // Action: generate image
    if (!action || action === 'generate') {
      const response = await fetch('https://external.api.recraft.ai/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + process.env.RECRAFT_API_KEY
        },
        body: JSON.stringify({
          prompt: prompt,
          style: style || 'digital_illustration',
          model: model || 'recraftv3',
          size: size || '1024x1024'
        })
      });
      const text = await response.text();
      console.log('Generate status:', response.status);
      return res.status(200).send(text);
    }

    // Action: remove background
    if (action === 'remove_background') {
      const imgResp = await fetch(imageUrl);
      const imgBuffer = await imgResp.arrayBuffer();
      const imgBytes = Buffer.from(imgBuffer);
      const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
      const header = Buffer.from(
        '--' + boundary + '\r\n' +
        'Content-Disposition: form-data; name="file"; filename="image.png"\r\n' +
        'Content-Type: image/png\r\n\r\n'
      );
      const footer = Buffer.from('\r\n--' + boundary + '--\r\n');
      const body = Buffer.concat([header, imgBytes, footer]);
      const response = await fetch('https://external.api.recraft.ai/v1/images/removeBackground', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + process.env.RECRAFT_API_KEY,
          'Content-Type': 'multipart/form-data; boundary=' + boundary
        },
        body: body
      });
      const text = await response.text();
      console.log('RemoveBG status:', response.status, text.substring(0, 200));
      return res.status(200).send(text);
    }

    // Action: crisp upscale
    if (action === 'upscale') {
      const imgResp = await fetch(imageUrl);
      const imgBuffer = await imgResp.arrayBuffer();
      const imgBytes = Buffer.from(imgBuffer);
      const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
      const header = Buffer.from(
        '--' + boundary + '\r\n' +
        'Content-Disposition: form-data; name="file"; filename="image.png"\r\n' +
        'Content-Type: image/png\r\n\r\n'
      );
      const footer = Buffer.from('\r\n--' + boundary + '--\r\n');
      const body = Buffer.concat([header, imgBytes, footer]);
      const response = await fetch('https://external.api.recraft.ai/v1/images/crispUpscale', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + process.env.RECRAFT_API_KEY,
          'Content-Type': 'multipart/form-data; boundary=' + boundary
        },
        body: body
      });
      const text = await response.text();
      console.log('Upscale status:', response.status, text.substring(0, 200));
      return res.status(200).send(text);
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
