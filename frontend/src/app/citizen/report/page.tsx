'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CitizenShell } from '../../../components/shells/CitizenShell';
import {
  Camera,
  MapPin,
  CheckCircle2,
  ArrowLeft,
  Send,
  X,
  AlertCircle,
  Loader2,
  RefreshCw,
  Lock,
  Compass
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Textarea } from '../../../components/ui/Textarea';
import { apiClient } from '../../../lib/api-client';
import { SignalAIPreview } from '../../../components/citizen/SignalAIPreview';
import { useAuth } from '../../../context/AuthContext';

const BHUBANESWAR_WARDS = [
  { id: 'WARD-018', name: 'Ward 18 (Nayapalli)', lat: 20.2961, lng: 85.8245, address: 'VIP Road, Jayadev Vihar Crossing, Nayapalli' },
  { id: 'WARD-004', name: 'Ward 04 (Saheed Nagar)', lat: 20.2882, lng: 85.8436, address: 'Janpath, Block B, Saheed Nagar' },
  { id: 'WARD-022', name: 'Ward 22 (Patia)', lat: 20.3533, lng: 85.8193, address: 'KIIT Road, Chandrasekharpur - Patia Corridor' },
  { id: 'WARD-012', name: 'Ward 12 (Old Town)', lat: 20.2405, lng: 85.8342, address: 'Rath Road, Near Lingaraj Temple Area' },
  { id: 'WARD-009', name: 'Ward 09 (Khandagiri)', lat: 20.2589, lng: 85.7876, address: 'Near Khandagiri Square, NH-16 Service Road' },
];

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB Canonical MVP Limit
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

const DEMO_DESCRIPTION_DEFAULT =
  'Huge water pipeline burst outside 4th cross road, water is flowing into basements and roads are completely flooded.';

export default function CitizenReportPage() {
  const { user, isDemoMode, loading: authLoading } = useAuth();

  const [description, setDescription] = useState(
    isDemoMode ? DEMO_DESCRIPTION_DEFAULT : ''
  );

  // Demo Mode Ward state
  const [selectedWard, setSelectedWard] = useState(BHUBANESWAR_WARDS[0]!);

  // Geolocation state
  const [customCoordinates, setCustomCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'locating' | 'acquired' | 'unavailable' | 'denied'>('idle');
  const [locationMessage, setLocationMessage] = useState<string | null>(null);

  // REAL_MODE manual coordinate fallback
  const [manualLat, setManualLat] = useState<string>('');
  const [manualLng, setManualLng] = useState<string>('');
  const [manualLocationRef, setManualLocationRef] = useState<string>('');
  const [showManualLocation, setShowManualLocation] = useState(false);

  // Photo attachment state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdSignal, setCreatedSignal] = useState<{
    id: string;
    ward_id?: string;
    ward_name?: string;
    created_at: string;
    status: string;
    problem_cluster_id?: string;
    cluster?: any;
    ai_analysis?: any;
  } | null>(null);

  const handleRequestGeolocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationStatus('unavailable');
      setLocationMessage('Browser geolocation is not supported on this device.');
      return;
    }

    setIsLocating(true);
    setLocationStatus('locating');
    setLocationMessage(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const coords = {
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
        };
        setCustomCoordinates(coords);
        setLocationStatus('acquired');
        setLocationMessage(
          `GPS Acquired: ${coords.lat.toFixed(4)}° N, ${coords.lng.toFixed(4)}° E (accuracy ±${Math.round(position.coords.accuracy || 10)}m)`
        );
      },
      (error) => {
        setIsLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationStatus('denied');
          setLocationMessage('Geolocation access was denied by your browser. Please enter coordinates or a landmark manually below.');
        } else {
          setLocationStatus('unavailable');
          setLocationMessage(`Device location unavailable (${error.message}). Please enter location manually below.`);
        }
      },
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 60000 }
    );
  }, []);

  // In REAL_MODE, automatically request browser geolocation on mount
  useEffect(() => {
    if (!isDemoMode && locationStatus === 'idle') {
      handleRequestGeolocation();
    }
  }, [isDemoMode, locationStatus, handleRequestGeolocation]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate 10 MB limit
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setPhotoError(`Selected image is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Maximum allowed size is 10 MB.`);
      return;
    }

    // Validate image MIME type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
      setPhotoError('Only image files (JPEG, PNG, WEBP, HEIC) are supported.');
      return;
    }

    setPhotoFile(file);
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
    }
    setPhotoError(null);
  };

  const handleSubmit = async () => {
    if (description.trim().length < 3) {
      setSubmitError('Please provide a description of at least 3 characters.');
      return;
    }

    // REAL_MODE requires authenticated user
    if (!isDemoMode && !user) {
      setSubmitError('You must be signed in to submit a citizen report in REAL_MODE. Please sign in and retry.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      let activeCoords: { lat: number; lng: number } | undefined = undefined;
      let locationRef: string | undefined = undefined;
      let wardId: string | undefined = undefined;

      if (isDemoMode) {
        // DEMO_MODE: preserve Ward 18 Golden Demo behavior
        activeCoords = customCoordinates || {
          lat: selectedWard.lat,
          lng: selectedWard.lng,
        };
        wardId = selectedWard.id;
        locationRef = selectedWard.address;
      } else {
        // REAL_MODE: derive coordinates from GPS or manual input, never hardcode Ward 18
        if (showManualLocation && manualLat.trim() && manualLng.trim()) {
          const lat = parseFloat(manualLat);
          const lng = parseFloat(manualLng);
          if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            setSubmitError('Please enter valid coordinates (-90 to 90 latitude, -180 to 180 longitude).');
            setIsSubmitting(false);
            return;
          }
          activeCoords = { lat, lng };
        } else if (customCoordinates) {
          activeCoords = customCoordinates;
        }

        if (manualLocationRef.trim()) {
          locationRef = manualLocationRef.trim();
        }

        // ward_id is intentionally omitted in REAL_MODE so the backend IGeographyProvider resolves it
        wardId = undefined;
      }

      // 1. Create Signal & Run Automated Ingestion Pipeline
      const signalRes = await apiClient.post<{
        data: {
          id: string;
          status: string;
          ward_id?: string;
          ward_name?: string;
          created_at: string;
          problem_cluster_id?: string;
          cluster?: any;
          ai_analysis?: any;
        };
        cluster?: any;
      }>(
        '/api/v1/signals',
        {
          original_text: description.trim(),
          ward_id: wardId,
          location: activeCoords,
          location_reference: locationRef,
          auto_process: true,
        }
      );

      const signal = {
        ...signalRes.data,
        cluster: signalRes.cluster || signalRes.data.cluster,
      };

      // 2. Decoupled Media Upload (if photo attached)
      if (photoFile) {
        // Register media with 10 MB limit
        const mediaRegRes = await apiClient.post<{
          data: { media_id: string; upload_url: string; storage_path: string };
        }>(`/api/v1/signals/${signal.id}/media`, {
          file_name: photoFile.name,
          mime_type: photoFile.type || 'image/jpeg',
          file_size_bytes: photoFile.size,
        });

        const { media_id, upload_url } = mediaRegRes.data;

        // Upload through storage provider
        await apiClient.uploadFile(upload_url, photoFile, photoFile.type || 'image/jpeg');

        // Associate media with signal
        await apiClient.post(`/api/v1/signals/${signal.id}/media/${media_id}/complete`);
      }

      setCreatedSignal(signal);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit signal. Please verify connection and retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <CitizenShell>
      <div className="space-y-6 max-w-xl mx-auto">
        <Link
          href="/citizen"
          className="inline-flex items-center gap-1.5 text-xs text-ink-secondary hover:text-ink-primary font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </Link>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-ink-primary">
            Report a public problem
          </h1>
          <p className="text-xs text-ink-secondary">
            Citizen Signals → Government Intelligence → Public Action
          </p>
        </div>

        {/* REAL_MODE unauthenticated notice */}
        {!isDemoMode && !user && !authLoading && (
          <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-800">
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Authentication Required in REAL_MODE</span>
            </div>
            <p className="leading-relaxed">
              You must be signed in with a citizen account to submit real signals. Reports will be securely tied to your profile.
            </p>
            <div className="pt-1">
              <Link href="/login">
                <Button variant="primary" size="sm" className="text-xs">
                  Sign In as Citizen
                </Button>
              </Link>
            </div>
          </div>
        )}

        {submitError && (
          <div className="p-3.5 rounded-xl border border-civic-rose/30 bg-rose-50 text-xs text-rose-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-civic-rose shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        {createdSignal ? (
          <div className="p-6 rounded-2xl border border-civic-emerald/30 bg-white shadow-card space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-civic-emeraldLight text-civic-emerald mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-ink-primary">
                {createdSignal.cluster?.isNewCluster
                  ? 'Problem Cluster Established'
                  : createdSignal.cluster?.matched
                  ? 'Signal Correlated with Problem'
                  : 'Signal Submitted'}
              </h3>
              <p className="text-xs text-ink-secondary">
                {createdSignal.cluster?.isNewCluster
                  ? 'Your report established a new verified public problem cluster in the municipal directory.'
                  : createdSignal.cluster?.matched
                  ? 'Your report was correlated with an existing municipal problem cluster.'
                  : 'Your report has been logged and queued for AI intelligence processing.'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-canvas-subtle border border-ink-border text-left text-xs space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-ink-secondary">Signal Reference:</span>
                <span className="font-mono font-bold text-ink-primary">#{createdSignal.id}</span>
              </div>

              {/* Public Problem Status */}
              <div className="flex justify-between items-center">
                <span className="text-ink-secondary">Public Problem:</span>
                {createdSignal.cluster?.problem ? (
                  <span className="font-mono font-bold text-civic-blue text-right">
                    #{createdSignal.cluster.problem.id}
                    <span className="block text-[11px] font-sans font-normal text-ink-primary truncate max-w-[200px]">
                      {createdSignal.cluster.problem.title}
                    </span>
                  </span>
                ) : createdSignal.problem_cluster_id ? (
                  <span className="font-mono font-bold text-civic-blue">#{createdSignal.problem_cluster_id}</span>
                ) : (
                  <span className="text-amber-700 font-semibold text-[11px]">Triage in progress</span>
                )}
              </div>

              {/* Correlation Type if available */}
              {createdSignal.cluster && (
                <div className="flex justify-between items-center">
                  <span className="text-ink-secondary">Correlation Type:</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                    {createdSignal.cluster.isNewCluster
                      ? 'New Public Problem Created'
                      : `Correlated (${createdSignal.cluster.relationship || 'Related'})`}
                  </span>
                </div>
              )}

              {/* Public Impact Score if calculated */}
              {createdSignal.cluster?.problem?.impact_score !== undefined && (
                <div className="flex justify-between items-center">
                  <span className="text-ink-secondary">Public Impact Score:</span>
                  <span className="font-mono font-bold text-civic-rose">
                    {createdSignal.cluster.problem.impact_score}/100 ({createdSignal.cluster.problem.impact_level || 'EVALUATED'})
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-ink-secondary">Location / Partition:</span>
                <span className="font-semibold text-ink-primary">
                  {isDemoMode
                    ? selectedWard.name
                    : createdSignal.ward_name || createdSignal.ward_id || (customCoordinates ? `${customCoordinates.lat.toFixed(4)}° N, ${customCoordinates.lng.toFixed(4)}° E` : 'Bhubaneswar')}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-ink-secondary">Processing Status:</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Processed & Correlated
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-ink-secondary">Submission Time:</span>
                <span className="font-mono text-ink-secondary text-[11px]">
                  {new Date(createdSignal.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            {/* AI Analysis Preview */}
            <div className="text-left">
              <SignalAIPreview
                signalId={createdSignal.id}
                initialProcessingStatus={createdSignal.ai_analysis ? 'COMPLETED' : 'PENDING'}
                initialAnalysis={createdSignal.ai_analysis || null}
              />
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Link href="/citizen/issues" className="block w-full">
                <Button variant="primary" className="w-full">
                  Track in My Reports
                </Button>
              </Link>
              <button
                onClick={() => {
                  setCreatedSignal(null);
                  setDescription(isDemoMode ? DEMO_DESCRIPTION_DEFAULT : '');
                  handleRemovePhoto();
                }}
                className="text-xs font-semibold text-civic-blue hover:underline py-1"
              >
                Submit another report
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Description Area */}
            <div className="space-y-2">
              <Textarea
                label="What happened?"
                placeholder="Describe what you see, hear, or experience..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
              <div className="flex justify-between text-[11px] text-ink-secondary">
                <span>Min 3 characters</span>
                <span>{description.length} / 5000 characters</span>
              </div>
            </div>

            {/* Photo Attachment (Strict 10MB Limit) */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-ink-primary flex items-center justify-between">
                <span>Attach Photo (Max 10 MB)</span>
                <span className="text-[11px] font-normal text-ink-secondary">JPEG, PNG, WEBP, HEIC</span>
              </div>

              {photoPreview ? (
                <div className="relative p-2 rounded-xl border border-ink-border bg-canvas-subtle flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-16 h-16 rounded-lg object-cover border border-ink-border"
                  />
                  <div className="flex-1 text-xs truncate">
                    <div className="font-medium text-ink-primary truncate">{photoFile?.name}</div>
                    <div className="text-ink-secondary text-[11px]">
                      {(photoFile!.size / (1024 * 1024)).toFixed(2)} MB
                    </div>
                  </div>
                  <button
                    onClick={handleRemovePhoto}
                    className="p-1.5 rounded-lg hover:bg-canvas text-ink-secondary hover:text-ink-primary transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-dashed border-ink-border bg-white hover:bg-canvas-subtle text-xs font-medium text-ink-primary transition-colors cursor-pointer">
                  <Camera className="w-4 h-4 text-civic-blue" />
                  <span>Choose Photo or Take Picture</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />
                </label>
              )}

              {photoError && (
                <div className="text-[11px] text-civic-rose font-medium flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{photoError}</span>
                </div>
              )}
            </div>

            {/* Location Section */}
            {isDemoMode ? (
              /* DEMO_MODE: Ward 18 Default + Presets Dropdown */
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-ink-primary">
                  <span>Location & Ward (Demo Mode)</span>
                  <button
                    type="button"
                    onClick={handleRequestGeolocation}
                    disabled={isLocating}
                    className="text-civic-blue hover:underline font-medium flex items-center gap-1"
                  >
                    {isLocating && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>Use Device GPS</span>
                  </button>
                </div>

                <div className="p-3.5 rounded-xl border border-ink-border bg-white space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <MapPin className="w-4 h-4 text-civic-rose shrink-0" />
                    <select
                      value={selectedWard.id}
                      onChange={(e) => {
                        const found = BHUBANESWAR_WARDS.find((w) => w.id === e.target.value);
                        if (found) setSelectedWard(found);
                      }}
                      className="w-full text-xs font-medium text-ink-primary bg-transparent focus:outline-none cursor-pointer"
                    >
                      {BHUBANESWAR_WARDS.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} — {w.address}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="text-[11px] font-mono text-ink-secondary pl-6">
                    Coordinates: {customCoordinates ? `${customCoordinates.lat.toFixed(4)}° N, ${customCoordinates.lng.toFixed(4)}° E (GPS)` : `${selectedWard.lat}° N, ${selectedWard.lng}° E`}
                  </div>

                  {locationMessage && (
                    <div className="text-[11px] text-ink-secondary pl-6 italic">
                      {locationMessage}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* REAL_MODE: Browser Geolocation + Retry + Manual Coordinate Fallback */
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-ink-primary">
                  <span className="flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-civic-blue" />
                    <span>Real-Mode Incident Location</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleRequestGeolocation}
                    disabled={isLocating}
                    className="text-civic-blue hover:underline font-medium flex items-center gap-1 text-xs"
                  >
                    {isLocating ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Locating...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3 h-3" />
                        <span>Retry Location</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Geolocation Status Card */}
                {isLocating ? (
                  <div className="p-4 rounded-xl border border-ink-border bg-white text-xs flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin text-civic-blue shrink-0" />
                    <span className="text-ink-secondary">Requesting device coordinates via browser geolocation...</span>
                  </div>
                ) : customCoordinates ? (
                  <div className="p-3.5 rounded-xl border border-civic-emerald/40 bg-emerald-50/50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                        <CheckCircle2 className="w-4 h-4 text-civic-emerald shrink-0" />
                        <span>GPS Coordinates Acquired</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                        Browser GPS
                      </span>
                    </div>
                    <div className="text-xs font-mono text-emerald-950">
                      {customCoordinates.lat.toFixed(5)}° N, {customCoordinates.lng.toFixed(5)}° E
                    </div>
                    {locationMessage && (
                      <div className="text-[11px] text-emerald-800/80 italic">
                        {locationMessage}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Location Unavailable</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRequestGeolocation}
                        className="text-xs text-civic-blue hover:underline font-semibold"
                      >
                        Retry Location
                      </button>
                    </div>
                    <p className="text-[11px] text-amber-900/90 leading-relaxed">
                      {locationMessage || 'Browser location permission was not granted or signal timed out. Please enter coordinates or address manually below.'}
                    </p>
                  </div>
                )}

                {/* Manual Coordinates Fallback Toggle */}
                <div className="p-3.5 rounded-xl border border-ink-border bg-white space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink-primary">
                      {showManualLocation || !customCoordinates ? 'Manual Coordinates / Landmark Fallback' : 'Manual Coordinates Fallback'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowManualLocation(!showManualLocation)}
                      className="text-xs text-civic-blue hover:underline font-medium"
                    >
                      {showManualLocation ? 'Hide manual fields' : 'Edit coordinates / landmark'}
                    </button>
                  </div>

                  {(showManualLocation || !customCoordinates) && (
                    <div className="space-y-2.5 pt-1">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                            Latitude
                          </label>
                          <input
                            type="number"
                            step="any"
                            placeholder="e.g. 20.2961"
                            value={manualLat}
                            onChange={(e) => setManualLat(e.target.value)}
                            className="w-full text-xs font-mono p-2 rounded-lg border border-ink-border bg-canvas-subtle focus:bg-white focus:outline-none focus:border-civic-blue"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                            Longitude
                          </label>
                          <input
                            type="number"
                            step="any"
                            placeholder="e.g. 85.8245"
                            value={manualLng}
                            onChange={(e) => setManualLng(e.target.value)}
                            className="w-full text-xs font-mono p-2 rounded-lg border border-ink-border bg-canvas-subtle focus:bg-white focus:outline-none focus:border-civic-blue"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                          Location Reference / Landmark
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Near Kalpana Square, Cuttack Road"
                          value={manualLocationRef}
                          onChange={(e) => setManualLocationRef(e.target.value)}
                          className="w-full text-xs p-2 rounded-lg border border-ink-border bg-canvas-subtle focus:bg-white focus:outline-none focus:border-civic-blue text-ink-primary"
                        />
                      </div>
                      <p className="text-[10px] text-ink-tertiary">
                        The backend derives ward boundaries automatically via municipal GIS boundary files.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notice */}
            <div className="p-3 rounded-xl border border-civic-blue/20 bg-civic-blueLight/20 text-[11px] text-ink-secondary leading-relaxed">
              Reports are stored securely as <strong>Active Signals</strong> with processing status <strong>Pending</strong>. Server-side DPDP PII redaction and Gemini AI analysis occur during ingest.
            </div>

            {/* Submit Action */}
            <div className="pt-2">
              <Button
                variant="primary"
                size="lg"
                className="w-full gap-2"
                onClick={handleSubmit}
                disabled={isSubmitting || description.trim().length < 3 || (!isDemoMode && !user)}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting Signal...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>{!isDemoMode && !user ? 'Sign in to Submit' : 'Submit Signal'}</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </CitizenShell>
  );
}
