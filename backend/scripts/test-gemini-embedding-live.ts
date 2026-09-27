import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { GeminiAIProvider } from '../src/providers/ai/gemini.provider';

async function main() {
  console.log('--- DIRECT GEMINI EMBEDDING LIVE SMOKE TEST ---');
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('ERROR: GEMINI_API_KEY is not set in environment.');
    process.exit(1);
  }

  const provider = new GeminiAIProvider({
    apiKey
  });

  const configuredModel = (provider as any).embeddingModel;
  console.log(`Configured Embedding Model: ${configuredModel}`);
  if (configuredModel !== 'gemini-embedding-001') {
    console.error(`FAILURE: Expected model 'gemini-embedding-001', got '${configuredModel}'`);
    process.exit(1);
  }

  const testText = 'Citizen demands regular public bus service along Ward 152 Main Road to improve daily transit connectivity.';
  console.log(`Generating embedding for sample input (${testText.length} chars)...`);

  const t0 = Date.now();
  try {
    const vector = await provider.generateEmbedding(testText);
    const duration = Date.now() - t0;

    console.log(`HTTP/API Call Succeeded in ${duration}ms`);
    console.log(`Vector is Array: ${Array.isArray(vector)}`);
    console.log(`Vector Length: ${vector.length}`);

    if (vector.length !== 1536) {
      console.error(`FAILURE: Expected vector dimensionality of 1536, got ${vector.length}`);
      process.exit(1);
    }

    console.log(`Vector Sample (first 3 components): [${vector.slice(0, 3).map(v => v.toFixed(6)).join(', ')}]`);
    console.log('SUCCESS: Gemini embedding verification passed with canonical gemini-embedding-001 at 1536 dimensions.');
    process.exitCode = 0;
  } catch (err: any) {
    console.error(`FAILURE: generateEmbedding threw error: ${err.message}`);
    process.exitCode = 1;
  }
}

main();
