import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const isProd = process.env.NODE_ENV === 'production';

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // API Routes
  app.post('/api/generate-tryon', async (req, res) => {
    try {
      const { wristImage, accessoryImage } = req.body;
      if (!wristImage || !accessoryImage) {
        return res.status(400).json({ error: 'wristImage and accessoryImage are required' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.json({ 
          image: wristImage,
          note: 'GEMINI_API_KEY not configured. Previewing with input image.' 
        });
      }

      const base64Wrist = wristImage.includes(',') ? wristImage.split(',')[1] : wristImage;
      const base64Acc = accessoryImage.includes(',') ? accessoryImage.split(',')[1] : accessoryImage;

      const prompt = "Synthesize these two images: Place the accessory (watch/bracelet) from the second image seamlessly and accurately onto the wrist in the first image. Make sure lighting, skin texture, perspective, shadows, and reflection look realistic and natural on the wrist.";

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;

      const payload = {
        contents: [{
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/jpeg", data: base64Wrist } },
            { inlineData: { mimeType: "image/jpeg", data: base64Acc } }
          ]
        }],
        generationConfig: {
          responseModalities: ['IMAGE']
        }
      };

      const geminiRes = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        console.warn('Gemini API response non-ok:', geminiRes.status, errText);
        return res.json({ image: wristImage, warning: 'AI service unavailable, displayed uploaded wrist.' });
      }

      const result: any = await geminiRes.json();
      const generatedPart = result?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);

      if (generatedPart && generatedPart.inlineData?.data) {
        return res.json({ 
          image: `data:${generatedPart.inlineData.mimeType};base64,${generatedPart.inlineData.data}` 
        });
      }

      return res.json({ image: wristImage });
    } catch (err: any) {
      console.error('Error generating try-on:', err);
      return res.status(500).json({ error: err.message || 'Generation failed', image: req.body?.wristImage });
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
