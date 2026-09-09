import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import { getFirebaseAuth } from '../src/infrastructure/firebase/firebase-admin';

async function main() {
  const auth = getFirebaseAuth();
  await auth.updateUser('fb_uid_citizen_synthetic_04', { password: 'REDACTED_PASSWORD' });
  console.log('Password for citizen2@example.com is confirmed: REDACTED_PASSWORD');
}

main().catch(console.error);
