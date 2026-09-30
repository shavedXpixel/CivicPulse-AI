async function checkHosted() {
  const base = process.env.HOSTED_BACKEND || process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v1\/?$/, '') || 'https://civicpulse-ai-backend-osz4.onrender.com';
  const endpoints = [
    `${base}/health`,
    `${base}/api/v1/health`,
    `${base}/api/v1/ready`,
    'https://civicpulse-ai-henna.vercel.app'
  ];

  for (const ep of endpoints) {
    try {
      const t0 = Date.now();
      const res = await fetch(ep, {
        headers: { 'User-Agent': 'CivicPulse-Hosted-Verifier' }
      });
      const duration = Date.now() - t0;
      const text = await res.text();
      console.log(`[${res.status}] ${ep} (${duration}ms):`);
      console.log(`  Body: ${text.substring(0, 200)}\n`);
    } catch (err: any) {
      console.error(`[ERROR] ${ep}: ${err.message}\n`);
    }
  }
}

checkHosted();
