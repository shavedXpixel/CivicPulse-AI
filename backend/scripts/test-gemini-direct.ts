import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  for (const m of ['gemini-3.6-flash', 'gemini-3.5-flash']) {
    console.log(`\nTesting model: ${m}...`);
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
    const t0 = Date.now();
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Respond with JSON {"status": "ok"}' }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });
      const duration = Date.now() - t0;
      console.log(`Model ${m} returned HTTP ${res.status} in ${duration}ms`);
      const body = await res.text();
      console.log(`Body snippet: ${body.substring(0, 100)}`);
    } catch (err: any) {
      console.log(`Model ${m} fetch error in ${Date.now() - t0}ms:`, err.message);
    }
  }
}

main();
