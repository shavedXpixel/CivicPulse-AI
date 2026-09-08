import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { getFirestoreDb, getFirebaseAuth } from '../src/infrastructure/firebase/firebase-admin';
import { GeminiAIProvider } from '../src/providers/ai/gemini.provider';

async function main() {
  console.log('--- Testing Live Credentials in REAL_MODE ---');
  console.log('Project ID:', process.env.FIREBASE_PROJECT_ID);
  console.log('Has Gemini Key:', !!process.env.GEMINI_API_KEY);

  // 1. Firebase Admin & Firestore Test
  try {
    const db = getFirestoreDb();
    console.log('Firestore client initialized. Testing ping collection write/read...');
    const testRef = db.collection('_system_health').doc('live_test');
    await testRef.set({ ping: true, timestamp: new Date().toISOString() });
    const snap = await testRef.get();
    console.log('Firestore write and read SUCCESS! Document data:', snap.data());
    await testRef.delete();
    console.log('Firestore clean up SUCCESS!');
  } catch (err: any) {
    console.error('Firestore FAILED:', err.message);
  }

  // 2. Firebase Auth Test & ID Token exchange
  let testIdToken = '';
  try {
    const auth = getFirebaseAuth();
    console.log('Firebase Auth client initialized.');
    const customToken = await auth.createCustomToken('test_health_check_uid', { role: 'CITIZEN' });
    console.log('Firebase Auth custom token creation SUCCESS! Token length:', customToken.length);

    // Exchange custom token for real ID token using Identity Toolkit and the real Firebase Web API key
    const firebaseWebApiKey = 'process.env.FIREBASE_WEB_API_KEY || ''';
    const exchangeUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${firebaseWebApiKey}`;
    const exchangeRes = await fetch(exchangeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true })
    });
    if (exchangeRes.ok) {
      const tokenData: any = await exchangeRes.json();
      testIdToken = tokenData.idToken;
      console.log('✓ Successfully exchanged custom token for genuine Firebase ID token!');
      console.log('  ID token length:', testIdToken.length);

      // Verify ID token with Firebase Admin
      const decoded = await auth.verifyIdToken(testIdToken);
      console.log('✓ Successfully verified genuine ID token with Firebase Admin! Decoded UID:', decoded.uid);
    } else {
      console.log('✗ Identity Toolkit exchange failed:', await exchangeRes.text());
    }
  } catch (err: any) {
    console.error('Firebase Auth FAILED:', err.message);
  }

  // 3. Gemini Provider Full Test
  try {
    console.log(`\nTesting GeminiAIProvider (model: ${process.env.AI_MODEL_GENERAL}, embedding: ${process.env.AI_MODEL_EMBEDDING})...`);
    const gemini = new GeminiAIProvider();
    const result = await gemini.analyzeSignal({
      text: 'Continuous sewage overflow and blocked stormwater drain on Damana Square near U G U P School for 3 days.',
      location_reference: 'Near Damana Square'
    });
    console.log('✓ Gemini analyzeSignal SUCCESS!');
    console.log('  Category:', result.category);
    console.log('  Severity:', result.severity);
    console.log('  Summary:', result.normalized_summary);
    console.log('  Entities:', result.entities);
    console.log('  Confidence:', result.confidence);

    const embedding = await gemini.generateEmbedding('Continuous sewage overflow and blocked stormwater drain');
    console.log('✓ Gemini generateEmbedding SUCCESS!');
    console.log('  Vector dimensions:', embedding.length);
  } catch (err: any) {
    console.error('✗ GeminiProvider FAILED:', err.message);
  }

  try {
    console.log('\nTesting gemini-embedding-001...');
    const embeddingEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`;
    const res = await fetch(embeddingEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        content: { parts: [{ text: 'Water supply pipeline burst in Nayapalli Ward 18' }] }
      })
    });
    if (res.ok) {
      const data = await res.json();
      console.log('✓ gemini-embedding-001 SUCCEEDED! Vector dimensions:', data?.embedding?.values?.length);
    } else {
      console.log('✗ gemini-embedding-001 failed:', await res.text());
    }
  } catch (err: any) {
    console.error('Embedding error:', err.message);
  }
}

main().catch(console.error);
