import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { ProviderContainer, MockDatabaseProvider, LocalStorageProvider } from '../src/providers';

describe('Decoupled Media Upload Workflow & 10MB Limit', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    ProviderContainer.setDatabaseProvider(new MockDatabaseProvider());
    ProviderContainer.setStorageProvider(new LocalStorageProvider());
    app = createApp();
  });

  it('registers media upload on a signal within 10 MB limit', async () => {
    const res = await request(app)
      .post('/api/v1/signals/sig_1001/media')
      .set('Authorization', 'Bearer demo-token-citizen')
      .send({
        file_name: 'leakage_photo.jpg',
        mime_type: 'image/jpeg',
        file_size_bytes: 2.5 * 1024 * 1024 // 2.5 MB
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.media_id).toMatch(/^med_/);
    expect(res.body.data.upload_url).toBeDefined();
    expect(res.body.data.storage_path).toBeDefined();
  });

  it('rejects media registration exceeding the 10 MB limit', async () => {
    const res = await request(app)
      .post('/api/v1/signals/sig_1001/media')
      .set('Authorization', 'Bearer demo-token-citizen')
      .send({
        file_name: 'huge_raw_image.jpg',
        mime_type: 'image/jpeg',
        file_size_bytes: 12 * 1024 * 1024 // 12 MB > 10 MB
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.message).toContain('10 MB');
  });

  it('prevents Citizen A from registering media on Citizen B signal', async () => {
    // sig_isolated_99 belongs to usr_citizen_02
    const res = await request(app)
      .post('/api/v1/signals/sig_isolated_99/media')
      .set('Authorization', 'Bearer demo-token-citizen') // usr_citizen_01
      .send({
        file_name: 'test.jpg',
        mime_type: 'image/jpeg',
        file_size_bytes: 1024 * 1024
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('completes the full upload and association workflow', async () => {
    // 1. Register media
    const regRes = await request(app)
      .post('/api/v1/signals/sig_1001/media')
      .set('Authorization', 'Bearer demo-token-citizen')
      .send({
        file_name: 'proof.png',
        mime_type: 'image/png',
        file_size_bytes: 50000
      });

    expect(regRes.status).toBe(201);
    const { media_id, upload_url } = regRes.body.data;

    // 2. Upload binary payload to upload_url
    const mockImageBuffer = Buffer.from('mock-png-image-binary-data');
    const uploadRes = await request(app)
      .put(upload_url)
      .set('Content-Type', 'image/png')
      .send(mockImageBuffer);

    expect(uploadRes.status).toBe(200);

    // 3. Mark media complete on the signal
    const completeRes = await request(app)
      .post(`/api/v1/signals/sig_1001/media/${media_id}/complete`)
      .set('Authorization', 'Bearer demo-token-citizen');

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.status).toBe('ATTACHED');

    // 4. Retrieve media metadata list for signal
    const listRes = await request(app)
      .get('/api/v1/signals/sig_1001/media')
      .set('Authorization', 'Bearer demo-token-citizen');

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((m: any) => m.id === media_id)).toBe(true);
  });
});
