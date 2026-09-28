import {
  Signal,
  SignalMediaItem,
  CreateSignalInput,
  RegisterMediaInput,
  RegisterMediaResponse,
  UserProfile,
  UserRole,
  SignalSourceType,
  SignalSeverity,
  SignalStatus,
  SignalProcessingStatus,
  ERROR_CODES
} from '@civicpulse/shared';
import { SignalRepository } from './signal.repository';
import { getStorageProvider, getGeographyProvider, SignalFilterCriteria } from '../../providers';
import { AppError } from '../../middleware/error.middleware';
import { env } from '../../config/env';
import { haversineDistanceKm } from '../clustering/similarity.math';

/**
 * Evaluates whether an incoming signal submission is a duplicate/retry of a recent signal.
 *
 * Exact Duplicate Fingerprint Definition:
 * Two reports from the same citizen within the cooldown window (default 60s) are considered
 * the same logical submission if and only if ALL of the following criteria match:
 * 1. Normalized text matches exactly:
 *    normalize(incoming.original_text) === normalize(recent.original_text).
 * 2. Location matches:
 *    - If both provide GPS coordinates: haversine distance <= 25 meters (0.025 km).
 *      Substantially different coordinates (> 25m) are treated as a NEW report.
 *    - If one provides coordinates and the other does not: considered DIFFERENT locations -> NEW report.
 *    - If neither provides coordinates: ward_id must match AND normalized location_reference must match.
 * 3. Category matches (if both provide a category).
 *
 * If ANY of text, location, or category is meaningfully different, it is treated as a NEW report.
 */
export function isDuplicateSignalFingerprint(
  incoming: CreateSignalInput,
  recent: Signal,
  cooldownMs: number = 60000,
  nowMs: number = Date.now()
): boolean {
  const createdAtMs = new Date(recent.created_at).getTime();
  if (nowMs - createdAtMs >= cooldownMs) {
    return false;
  }

  // 1. Text check: normalized original_text
  const incomingText = (incoming.original_text || '').trim().toLowerCase();
  const recentText = (recent.original_text || '').trim().toLowerCase();
  if (incomingText !== recentText) {
    return false;
  }

  // 2. Category check: if both specify category, they must match
  if (incoming.category && recent.category) {
    if (incoming.category !== recent.category) {
      return false;
    }
  }

  // 3. Location check
  const incomingHasCoords =
    incoming.location &&
    typeof incoming.location.lat === 'number' &&
    typeof incoming.location.lng === 'number';
  const recentHasCoords =
    recent.location &&
    typeof recent.location.lat === 'number' &&
    typeof recent.location.lng === 'number';

  if (incomingHasCoords && recentHasCoords) {
    const distKm = haversineDistanceKm(
      incoming.location!.lat,
      incoming.location!.lng,
      recent.location!.lat,
      recent.location!.lng
    );
    // Distance > 25 meters (0.025 km) is considered a distinct physical location
    if (distKm > 0.025) {
      return false;
    }
  } else if (incomingHasCoords !== recentHasCoords) {
    // One has explicit coordinates and the other does not
    return false;
  } else {
    // Neither has coordinates: compare ward_id and location_reference
    const incomingWard = incoming.ward_id || '';
    const recentWard = recent.ward_id || '';
    if (incomingWard !== recentWard) {
      return false;
    }

    const incomingRef = (incoming.location_reference || '').trim().toLowerCase();
    const recentRef = (recent.location_reference || '').trim().toLowerCase();
    if (incomingRef !== recentRef) {
      return false;
    }
  }

  return true;
}

export class SignalService {
  constructor(private repo: SignalRepository = new SignalRepository()) {}

  async createSignal(user: UserProfile, input: CreateSignalInput): Promise<Signal> {
    // Duplicate submission cooldown check for pipeline submissions
    if (user.role === UserRole.CITIZEN && input.auto_process) {
      const recentSignals = await this.repo.list({
        citizen_id: user.id,
        limit: 10
      });
      const nowMs = Date.now();
      const matchingRecent = recentSignals.data.find((s) =>
        isDuplicateSignalFingerprint(input, s, 60000, nowMs)
      );

      if (matchingRecent) {
        // If the prior signal was already successfully clustered, protect against rapid duplicates
        if (matchingRecent.problem_cluster_id && matchingRecent.processing_status === SignalProcessingStatus.COMPLETED) {
          throw new AppError({
            statusCode: 409,
            code: ERROR_CODES.CONFLICT,
            message: 'Duplicate report submission detected within cooldown window. Please wait before submitting identical reports.'
          });
        }

        // If the prior signal is unclustered / pending / degraded, idempotently return the existing signal
        // so the citizen or background runner can re-attempt processing without creating a duplicate record.
        return matchingRecent;
      }
    }

    const id = `sig_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    let resolvedWardId: string | undefined = input.ward_id || user.ward_id || undefined;
    let resolvedWardName: string | undefined = undefined;
    let resolvedProvenance: import('@civicpulse/shared').ProvenanceSource | undefined = undefined;

    if (!env.DEMO_MODE) {
      // REAL_MODE: derive ward strictly from coordinates via IGeographyProvider
      if (input.location && typeof input.location.lat === 'number' && typeof input.location.lng === 'number') {
        const geoProvider = getGeographyProvider();
        const wardInfo = await geoProvider.getWardByCoordinates(input.location.lat, input.location.lng);
        if (wardInfo) {
          resolvedWardId = wardInfo.ward_id;
          resolvedWardName = wardInfo.ward_name;
          resolvedProvenance = wardInfo.provenance;
        } else {
          // Reference data unavailable or point outside coverage: do NOT default to Ward 18
          resolvedWardId = undefined;
          resolvedWardName = undefined;
          resolvedProvenance = 'UNKNOWN';
        }
      } else {
        // No coordinates provided in REAL_MODE
        resolvedWardId = input.ward_id || undefined;
        resolvedWardName = undefined;
        resolvedProvenance = 'UNKNOWN';
      }
    }

    const signal: Signal = {
      id,
      source_type: user.role === UserRole.FIELD_OFFICER ? SignalSourceType.FIELD_OFFICER : SignalSourceType.CITIZEN,
      citizen_id: user.id,
      original_text: input.original_text,
      category: input.category || undefined,
      ward_id: resolvedWardId,
      ward_name: resolvedWardName,
      geography_provenance: resolvedProvenance,
      location: input.location || undefined,
      location_source: input.location_source || undefined,
      location_accuracy_m: typeof input.location_accuracy_m === 'number' ? input.location_accuracy_m : undefined,
      location_reference: input.location_reference || undefined,
      severity: SignalSeverity.UNKNOWN,
      status: SignalStatus.ACTIVE,
      processing_status: SignalProcessingStatus.PENDING,
      created_at: now,
      updated_at: now,
      submitted_at: now,
      media_ids: input.media_ids || []
    };

    return this.repo.create(signal);
  }

  async getSignal(user: UserProfile, signalId: string): Promise<Signal> {
    const signal = await this.repo.findById(signalId);
    if (!signal) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: 'Signal not found.'
      });
    }

    // 1. SIGNAL READ AUTHORIZATION SCOPE ENFORCEMENT
    if (user.role === UserRole.CITIZEN) {
      // Citizen may only view own signal. Return 404 for privacy protection.
      if (signal.citizen_id !== user.id) {
        throw new AppError({
          statusCode: 404,
          code: ERROR_CODES.NOT_FOUND,
          message: 'Signal not found.'
        });
      }
    } else if (user.role === UserRole.DEPARTMENT_OFFICER || user.role === UserRole.FIELD_OFFICER) {
      if (signal.department_id && user.department_id && signal.department_id !== user.department_id) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: 'Access denied to signals outside your department.'
        });
      }
    }

    return signal;
  }

  async listSignals(
    user: UserProfile,
    query: Partial<SignalFilterCriteria>
  ): Promise<{ data: Signal[]; nextCursor?: string }> {
    const effectiveFilter: SignalFilterCriteria = {
      limit: query.limit || 20,
      cursor: query.cursor,
      status: query.status,
      category: query.category,
      ward_id: query.ward_id
    };

    // 1. SIGNAL READ AUTHORIZATION SCOPE ENFORCEMENT
    if (user.role === UserRole.CITIZEN) {
      // Unconditionally force citizen_id to authenticated user.
      // Never allow a citizen to query another user's signals.
      effectiveFilter.citizen_id = user.id;
    } else if (user.role === UserRole.FIELD_OFFICER) {
      // Field officer is strictly scoped to their assigned department.
      // Field officers cannot query citywide or cross-department citizen signals.
      if (user.department_id) {
        effectiveFilter.department_id = user.department_id;
      } else {
        return { data: [] };
      }
    } else if (user.role === UserRole.DEPARTMENT_OFFICER && user.department_id) {
      effectiveFilter.department_id = user.department_id;
    } else if (query.citizen_id && (user.role === UserRole.ADMIN || user.role === UserRole.SYSTEM_ADMIN)) {
      effectiveFilter.citizen_id = query.citizen_id;
    }

    return this.repo.list(effectiveFilter);
  }

  async registerMedia(
    user: UserProfile,
    signalId: string,
    input: RegisterMediaInput
  ): Promise<RegisterMediaResponse> {
    const signal = await this.repo.findById(signalId);
    if (!signal) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: 'Signal not found.'
      });
    }

    // Ownership check
    if (user.role === UserRole.CITIZEN && signal.citizen_id !== user.id) {
      throw new AppError({
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
        message: 'Cannot attach media to a signal you do not own.'
      });
    }

    const mediaId = `med_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    const storage = getStorageProvider();
    const uploadResult = await storage.getSignedUploadUrl(
      input.file_name,
      input.mime_type,
      input.file_size_bytes,
      {
        signalId,
        mediaId
      }
    );

    const mediaItem: SignalMediaItem = {
      id: mediaId,
      signal_id: signalId,
      storage_path: uploadResult.storagePath,
      media_type: 'IMAGE',
      mime_type: input.mime_type,
      file_size_bytes: input.file_size_bytes,
      uploaded_by: user.id,
      created_at: now,
      analysis_status: 'NOT_ANALYZED'
    };

    await this.repo.createMedia(mediaItem);

    return {
      media_id: mediaId,
      upload_url: uploadResult.uploadUrl,
      storage_path: uploadResult.storagePath,
      expires_at: uploadResult.expiresAt
    };
  }

  async completeMedia(user: UserProfile, signalId: string, mediaId: string): Promise<void> {
    const signal = await this.repo.findById(signalId);
    if (!signal) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: 'Signal not found.'
      });
    }

    if (user.role === UserRole.CITIZEN && signal.citizen_id !== user.id) {
      throw new AppError({
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
        message: 'Cannot modify media on a signal you do not own.'
      });
    }

    await this.repo.attachMedia(signalId, mediaId);
  }

  async getSignalMedia(user: UserProfile, signalId: string): Promise<SignalMediaItem[]> {
    // Check signal read scope first
    await this.getSignal(user, signalId);
    return this.repo.getMedia(signalId);
  }

  async updateSignal(id: string, updates: Partial<Signal>): Promise<Signal> {
    return this.repo.update(id, updates);
  }
}
