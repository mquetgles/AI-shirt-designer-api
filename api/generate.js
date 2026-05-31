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

    // Action: crisp upscale (Recraft) - now runs BEFORE background removal
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
      console.log('Upscale status:', response.status);
      return res.status(200).send(text);
    }

    // Action: remove background using BiRefNet via Replicate
    // Runs AFTER upscale to preserve transparency in final PNG
    if (action === 'remove_background') {
      // Start the Replicate prediction
      const startResp = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': 'Token ' + process.env.REPLICATE_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          version: '9c100f8f99e38a8cbb065104aa35b39a21901f7ae7aad88a7b75cac59e3a2be9',
          input: {
            image: imageUrl
          }
        })
      });
      const startData = await startResp.json();
      console.log('Replicate start:', JSON.stringify(startData));

      if (!startData.id) {
        return res.status(500).json({ error: 'Replicate prediction failed to start', detail: startData });
      }

      // Poll for result
      var predictionId = startData.id;
      var resultUrl = null;
      for (var attempt = 0; attempt < 30; attempt++) {
        await new Promise(r => setTimeout(r, 2000));
        const pollResp = await fetch('https://api.replicate.com/v1/predictions/' + predictionId, {
          headers: { 'Authorization': 'Token ' + process.env.REPLICATE_API_KEY }
        });
        const pollData = await pollResp.json();
        console.log('Poll attempt', attempt, 'status:', pollData.status);
        if (pollData.status === 'succeeded') {
          resultUrl = Array.isArray(pollData.output) ? pollData.output[0] : pollData.output;
          break;
        }
        if (pollData.status === 'failed' || pollData.status === 'canceled') {
          return res.status(500).json({ error: 'BiRefNet failed', detail: pollData });
        }
      }

      if (!resultUrl) {
        return res.status(500).json({ error: 'BiRefNet timed out' });
      }

      return res.status(200).json({ url: resultUrl });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
