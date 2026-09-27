import { Router, Request, Response } from 'express';
import { getStorageProvider, LocalStorageProvider, getDatabaseProvider } from '../../providers';
import { MAX_MEDIA_FILE_SIZE_BYTES, UserRole, ProblemStatus } from '@civicpulse/shared';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

// Apply authentication to all storage endpoints
router.use(authMiddleware);

// Strict server-side storage path format: strictly in signals/ or evidence/ (supports deterministic nested subpaths)
const ALLOWED_STORAGE_PATH_REGEX = /^(signals|evidence)\/([a-zA-Z0-9._-]+\/)*[a-zA-Z0-9._-]+\.(jpg|jpeg|png|webp)$/;

/**
 * Validates binary image magic bytes against supported image formats.
 * Prevents disguised executables, scripts, or corrupted files.
 */
function detectImageMimeType(buffer: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (!buffer || buffer.length < 3) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WEBP: RIFF (bytes 0-3) + WEBP (bytes 8-11)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

// PUT /api/v1/storage/upload?path=...&mime=...
router.put('/upload', async (req: Request, res: Response) => {
  const storagePath = req.query.path as string;
  const mimeType = (req.query.mime as string) || (req.headers['content-type'] as string) || 'image/jpeg';

  if (!storagePath) {
    res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing storage path parameter.' } });
    return;
  }

  // Path Traversal & Whitelist Enforcement
  if (storagePath.includes('..') || storagePath.includes('\\') || storagePath.startsWith('/') || !ALLOWED_STORAGE_PATH_REGEX.test(storagePath)) {
    res.status(400).json({
      error: {
        code: 'INVALID_STORAGE_PATH',
        message: 'Invalid storage path. Paths must reside in signals/ or evidence/ with allowed extensions (jpg, jpeg, png, webp) and no directory traversal.'
      }
    });
    return;
  }

  const storage = getStorageProvider();

  // Overwrite Protection: Check if object already exists
  const exists = storage.objectExists
    ? await storage.objectExists(storagePath)
    : (storage instanceof LocalStorageProvider && Boolean(storage.getLocalFile(storagePath)));

  if (exists) {
    res.status(409).json({
      error: {
        code: 'OBJECT_ALREADY_EXISTS',
        message: `An object already exists at "${storagePath}". Overwrites are strictly prohibited to preserve immutable evidence integrity.`
      }
    });
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

    if (buffer.length === 0) {
      res.status(400).json({
        error: {
          code: 'EMPTY_FILE',
          message: 'Cannot upload empty zero-byte file.'
        }
      });
      return;
    }

    // Binary Magic Byte Content Validation
    const detectedMime = detectImageMimeType(buffer);
    if (!detectedMime) {
      res.status(400).json({
        error: {
          code: 'INVALID_FILE_CONTENT',
          message: 'Uploaded file binary content does not match supported image formats (JPEG, PNG, WEBP).'
        }
      });
      return;
    }

    // MIME vs Content Consistency Check
    const normalizedReqMime = mimeType.toLowerCase();
    const isJpegMatch = (normalizedReqMime === 'image/jpeg' || normalizedReqMime === 'image/jpg') && detectedMime === 'image/jpeg';
    const isPngMatch = normalizedReqMime === 'image/png' && detectedMime === 'image/png';
    const isWebpMatch = normalizedReqMime === 'image/webp' && detectedMime === 'image/webp';

    if (!isJpegMatch && !isPngMatch && !isWebpMatch) {
      res.status(400).json({
        error: {
          code: 'MIME_TYPE_MISMATCH',
          message: `Declared MIME type (${mimeType}) does not match detected binary content type (${detectedMime}).`
        }
      });
      return;
    }

    if (storage.saveFile) {
      await storage.saveFile(storagePath, buffer, detectedMime);
    } else if (storage.saveLocalFile) {
      await storage.saveLocalFile(storagePath, buffer, detectedMime);
    }

    res.status(200).json({
      data: {
        storagePath,
        size: buffer.length,
        mimeType: detectedMime,
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
router.get('/files', async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required to access media.' } });
    return;
  }

  const storagePath = req.query.path as string;

  if (!storagePath || storagePath.includes('..') || storagePath.includes('\\') || storagePath.startsWith('/') || !ALLOWED_STORAGE_PATH_REGEX.test(storagePath)) {
    res.status(400).json({
      error: {
        code: 'INVALID_STORAGE_PATH',
        message: 'Invalid storage path parameter.'
      }
    });
    return;
  }

  const db = getDatabaseProvider();

  // 1. SIGNAL MEDIA AUTHORIZATION
  if (storagePath.startsWith('signals/')) {
    const mediaItem = await db.getSignalMediaByPath(storagePath);
    if (!mediaItem) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Requested signal media not found or access denied.'
        }
      });
      return;
    }

    const signal = await db.getSignal(mediaItem.signal_id);
    const signalOwnerId = signal?.citizen_id || mediaItem.uploaded_by;

    // A. Citizen Scoping: Citizens can only view their own signals' media
    if (user.role === UserRole.CITIZEN) {
      if (user.id !== signalOwnerId) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'You are not authorized to view media submitted by another citizen.'
          }
        });
        return;
      }
    }
    // B. Field Officer Scoping: Can only view within assigned department (or unassigned signals)
    else if (user.role === UserRole.FIELD_OFFICER) {
      if (signal?.department_id && user.department_id && signal.department_id !== user.department_id) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Field officers cannot view media outside their department scope.'
          }
        });
        return;
      }
    }
    // C. Department Officer Scoping: Can only view within their department (or unassigned signals)
    else if (user.role === UserRole.DEPARTMENT_OFFICER) {
      if (signal?.department_id && user.department_id && signal.department_id !== user.department_id) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Department officers cannot view media outside their department.'
          }
        });
        return;
      }
    }
    // Admin / System Admin: permitted
  }

  // 2. RESOLUTION EVIDENCE AUTHORIZATION
  else if (storagePath.startsWith('evidence/')) {
    let evidence = await db.getResolutionEvidenceByPath(storagePath);
    let problemId = evidence?.problem_id;

    if (!evidence) {
      const mediaItem = await db.getSignalMediaByPath(storagePath);
      if (mediaItem && mediaItem.signal_id) {
        const cluster = await db.getProblemCluster(mediaItem.signal_id);
        if (cluster) {
          problemId = cluster.id;
        }
      }
    }

    if (!evidence && !problemId) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Requested evidence media not found or access denied.'
        }
      });
      return;
    }

    const problem = problemId ? await db.getProblemCluster(problemId) : null;

    // A. Citizen Scoping: Citizens can only view resolution evidence for problems they reported or are members of, OR when problem is public/resolved
    if (user.role === UserRole.CITIZEN) {
      let isCitizenReporter = false;
      if (problem) {
        const members = await db.getProblemClusterMembers(problem.id);
        for (const member of members) {
          const memberSignal = await db.getSignal(member.signal_id);
          if (memberSignal && memberSignal.citizen_id === user.id) {
            isCitizenReporter = true;
            break;
          }
        }
      }

      const isPublicResolved = problem?.status === ProblemStatus.RESOLVED || problem?.status === ProblemStatus.CLOSED;
      if (!isCitizenReporter && !isPublicResolved) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Citizens cannot access in-progress resolution evidence for unrelated problems.'
          }
        });
        return;
      }
    }
    // B. Field Officer Scoping: Field officer must be assigned or belong to the problem's department
    else if (user.role === UserRole.FIELD_OFFICER) {
      const isAssigned =
        problem?.assigned_to === user.id ||
        (user as any).legacy_firebase_uid === problem?.assigned_to ||
        (user as any).auth_user_id === problem?.assigned_to;
      const isSameDept = Boolean(problem?.department_id && user.department_id && problem.department_id === user.department_id);
      if (!isAssigned && !isSameDept) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Field officers cannot access resolution evidence for problems outside their assigned work.'
          }
        });
        return;
      }
    }
    // C. Department Officer Scoping: Department officer must match the problem's department
    else if (user.role === UserRole.DEPARTMENT_OFFICER) {
      if (problem?.department_id && user.department_id && problem.department_id !== user.department_id) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Department officers cannot view resolution evidence from other departments.'
          }
        });
        return;
      }
    }
    // Admin / System Admin: permitted
  }

  // 3. RETRIEVE AND STREAM
  const storage = getStorageProvider();

  if (storage.getFile) {
    const file = await storage.getFile(storagePath);
    if (!file) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Stored file not found.' } });
      return;
    }
    res.setHeader('Content-Type', file.mimeType);
    res.send(file.buffer);
    return;
  }

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
