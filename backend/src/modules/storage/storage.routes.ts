import { Router, Request, Response } from 'express';
import { getStorageProvider, LocalStorageProvider } from '../../providers';
import { MAX_MEDIA_FILE_SIZE_BYTES } from '@civicpulse/shared';

const router = Router();

// PUT /api/v1/storage/upload?path=...&mime=...
router.put('/upload', (req: Request, res: Response) => {
  const storagePath = req.query.path as string;
  const mimeType = (req.query.mime as string) || 'image/jpeg';

  if (!storagePath) {
    res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing storage path parameter.' } });
    return;
  }

  const chunks: Buffer[] = [];
  let totalLength = 0;

  req.on('data', (chunk) => {
    chunks.push(chunk);
    totalLength += chunk.length;
    if (totalLength > MAX_MEDIA_FILE_SIZE_BYTES) {
      req.destroy();
      res.status(413).json({
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: `File exceeds the maximum permitted limit of 10 MB (${MAX_MEDIA_FILE_SIZE_BYTES} bytes).`
        }
      });
    }
  });

  req.on('end', async () => {
    if (res.writableEnded) return;
    const buffer = Buffer.concat(chunks);
    const storage = getStorageProvider();

    if (storage instanceof LocalStorageProvider && storage.saveLocalFile) {
      await storage.saveLocalFile(storagePath, buffer, mimeType);
    }

    res.status(200).json({
      data: {
        storagePath,
        size: buffer.length,
        status: 'UPLOADED'
      }
    });
  });

  req.on('error', (err) => {
    if (!res.writableEnded) {
      res.status(500).json({ error: { code: 'UPLOAD_FAILED', message: err.message } });
    }
  });
});

// GET /api/v1/storage/files?path=...
router.get('/files', (req: Request, res: Response) => {
  const storagePath = req.query.path as string;
  const storage = getStorageProvider();

  if (storage instanceof LocalStorageProvider) {
    const file = storage.getLocalFile(storagePath);
    if (!file) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Stored file not found.' } });
      return;
    }
    res.setHeader('Content-Type', file.mimeType);
    res.send(file.buffer);
    return;
  }

  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'File not found.' } });
});

export { router as storageRouter };
