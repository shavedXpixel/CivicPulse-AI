import http from 'http';
import app from '../api/index';

async function main() {
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  console.log(`[Local Vercel Runtime Test] Server running on port ${port}`);

  try {
    // Test 1: GET /health
    const res1 = await fetch(`http://127.0.0.1:${port}/health`);
    const body1 = await res1.json();
    console.log(`[GET /health] Status: ${res1.status}, Body:`, body1);

    if (res1.status !== 200 || body1.status !== 'ok') {
      throw new Error(`Expected /health to return 200 with status ok, got ${res1.status}`);
    }

    // Test 2: GET /api/v1/health
    const res2 = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
    const body2 = await res2.json();
    console.log(`[GET /api/v1/health] Status: ${res2.status}, Body:`, body2);

    if (res2.status !== 200 || body2.data?.status !== 'ok') {
      throw new Error(`Expected /api/v1/health to return 200 with data.status ok, got ${res2.status}`);
    }

    // Test 3: Verify path preservation (not rewritten to / or /api/index)
    // A request to a non-existent route should return 404 with exact requested path in message
    const res3 = await fetch(`http://127.0.0.1:${port}/non-existent-test-path`);
    const body3 = await res3.json();
    console.log(`[Path Preservation Check] Status: ${res3.status}, Message:`, body3.error?.message || body3.message);

    console.log('\nAll Vercel runtime tests PASSED successfully!');
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('[Local Vercel Runtime Test] FAILED:', err);
  process.exit(1);
});
