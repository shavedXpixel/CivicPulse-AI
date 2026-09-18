import { GCSStorageProvider } from '../src/providers/storage/gcs.storage';
import { getFirebaseAdminApp } from '../src/infrastructure/firebase/firebase-admin';
import { getStorage } from 'firebase-admin/storage';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

async function main() {
  console.log('=== GCS PROVIDER CONNECTIVITY VERIFICATION ===');
  const bucketName = process.env.STORAGE_BUCKET || 'civicpulse-ai-f1bbf.firebasestorage.app';
  console.log(`Configured Bucket: ${bucketName}`);

  const runId = `verify_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const testPath = `evidence/connectivity_test_${runId}.jpg`;
  const testBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

  try {
    const app = getFirebaseAdminApp();
    const bucket = getStorage(app).bucket(bucketName);

    // 1. Inspect project for existing buckets
    console.log('Step 1: Inspecting project for available Cloud Storage buckets...');
    try {
      const [availableBuckets] = await bucket.storage.getBuckets();
      const bucketNames = availableBuckets.map((b) => b.name);
      console.log(`Discovered project buckets (${bucketNames.length}):`, bucketNames.length > 0 ? bucketNames.join(', ') : '[None]');
    } catch (err: any) {
      console.log('Note: Unable to list project buckets (requires storage.buckets.list):', err.message);
    }

    // 2. Check configured bucket existence
    console.log(`Step 2: Checking existence of configured bucket "${bucketName}"...`);
    const [bucketExists] = await bucket.exists();
    console.log(`Configured bucket exists: ${bucketExists}`);

    if (!bucketExists) {
      console.log(`\n[PREREQUISITE NOTICE]`);
      console.log(`Configured bucket "${bucketName}" does not exist in Google Cloud project.`);
      console.log(`Cloud Storage bucket provisioning is pending active Google Cloud Billing.`);
      console.log(`Status: BLOCKED - Pending active billing and bucket provisioning.`);
      return;
    }

    const provider = new GCSStorageProvider(bucketName);

    // 2. Object create
    console.log(`Step 2: Creating test object at "${testPath}"...`);
    await provider.saveFile(testPath, testBuffer, 'image/jpeg');
    console.log('Object create: SUCCESS');

    // 3. Object exists check
    console.log('Step 3: Checking object existence...');
    const exists = await provider.objectExists(testPath);
    console.log(`Object exists: ${exists}`);

    // 4. Object read
    console.log('Step 4: Reading object...');
    const file = await provider.getFile(testPath);
    const readMatch = Boolean(file && file.buffer.equals(testBuffer));
    console.log(`Object read matches original: ${readMatch}`);

    // 5. Object delete
    console.log('Step 5: Deleting test object...');
    await provider.deleteFile(testPath);
    console.log('Object delete: SUCCESS');

    // 6. Verify deletion
    console.log('Step 6: Verifying deletion...');
    const existsAfter = await provider.objectExists(testPath);
    console.log(`Object exists after deletion: ${existsAfter}`);

    if (exists && readMatch && !existsAfter) {
      console.log('=== GCS CONNECTIVITY VERIFICATION: FULLY VERIFIED (ALL STEPS PASSED) ===');
    } else {
      console.log('=== GCS CONNECTIVITY VERIFICATION: INCOMPLETE ===');
    }
  } catch (error: any) {
    console.error('=== GCS CONNECTIVITY VERIFICATION: FAILED ===');
    console.error('Error Code:', error.code);
    console.error('Error Message:', error.message);
    if (error.errors) {
      console.error('API Errors:', JSON.stringify(error.errors, null, 2));
    }
  }
}

main();
