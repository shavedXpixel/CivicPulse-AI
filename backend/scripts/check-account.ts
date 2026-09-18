import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import { getFirebaseAuth } from '../src/infrastructure/firebase/firebase-admin';

const apiKey = process.env.FIREBASE_WEB_API_KEY || '';
const pw = process.argv[2];

async function check(email: string) {
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pw, returnSecureToken: true })
    });
    const data: any = await res.json();
    if (res.ok) {
      console.log(`[SUCCESS] ${email} authenticated successfully. UID: ${data.localId}`);
    } else {
      console.log(`[FAILED] ${email}: ${data.error?.message}`);
    }
  } catch (err: any) {
    console.error(`[ERROR] ${email}:`, err.message);
  }
}

async function main() {
  const auth = getFirebaseAuth();
  for (const email of ['test-citizen@example.com', 'officer@example.com', 'field@example.com', 'admin@example.com']) {
    const user = await auth.getUserByEmail(email);
    console.log(`User: ${email} | providers: ${user.providerData.map(p => p.providerId).join(',')} | disabled: ${user.disabled}`);
    if (pw) {
      await check(email);
    }
  }
}

main();
