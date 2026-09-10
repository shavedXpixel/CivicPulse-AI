'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CitizenShell } from '../../../components/shells/CitizenShell';
import {
  Camera,
  MapPin,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Send,
  X,
  AlertCircle,
  Loader2,
  RefreshCw,
  Lock,
  Compass,
  Sparkles,
  Info,
  Edit3,
  ShieldCheck,
  Check
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

type ReportStage = 'describe' | 'location' | 'media' | 'review' | 'processing' | 'result';

function CitizenReportContent() {
  const { user, isDemoMode, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const intakeMode = searchParams.get('mode') || 'text';

  const [stage, setStage] = useState<ReportStage>('describe');

  // Stage 1: Description state
  const [description, setDescription] = useState(
    isDemoMode ? DEMO_DESCRIPTION_DEFAULT : ''
  );
  const [descriptionError, setDescriptionError] = useState<string | null>(null);

  // Stage 2: Location state
  const [selectedWard, setSelectedWard] = useState(BHUBANESWAR_WARDS[0]!);
  const [customCoordinates, setCustomCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'locating' | 'acquired' | 'unavailable' | 'denied'>('idle');
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [manualLat, setManualLat] = useState<string>('');
  const [manualLng, setManualLng] = useState<string>('');
  const [manualLocationRef, setManualLocationRef] = useState<string>('');
  const [useManualEntry, setUseManualEntry] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Stage 3: Media state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Stage 5 & 6: Submission & Processing state
  const [processingStatusText, setProcessingStatusText] = useState<string>('Submitting your report…');
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

  // Request browser GPS geolocation
  const handleRequestGeolocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationStatus('unavailable');
      setLocationMessage('Browser geolocation is not supported on this device.');
      return;
    }

    setIsLocating(true);
    setLocationStatus('locating');
    setLocationMessage(null);
    setLocationError(null);

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
          setLocationMessage('Geolocation permission denied. You can enter coordinates or a landmark manually below.');
        } else {
          setLocationStatus('unavailable');
          setLocationMessage(`Location unavailable (${error.message}). You can enter coordinates or a landmark manually below.`);
        }
      },
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 60000 }
    );
  }, []);

  // In REAL_MODE, automatically request GPS on mount
  useEffect(() => {
    if (!isDemoMode && locationStatus === 'idle') {
      handleRequestGeolocation();
    }
  }, [isDemoMode, locationStatus, handleRequestGeolocation]);

  // Stage 3: Media handlers
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setPhotoError(`Selected image is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Maximum allowed size is 10 MB.`);
      return;
    }

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

  // Step transition validators
  const handleNextFromDescribe = () => {
    if (description.trim().length < 3) {
      setDescriptionError('Please describe the issue in at least 3 characters.');
      return;
    }
    setDescriptionError(null);
    setStage('location');
  };

  const handleNextFromLocation = () => {
    setLocationError(null);
    if (useManualEntry) {
      if (manualLat.trim() && manualLng.trim()) {
        const lat = parseFloat(manualLat);
        const lng = parseFloat(manualLng);
        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          setLocationError('Please enter valid coordinates (-90 to 90 lat, -180 to 180 lng).');
          return;
        }
      }
    }
    setStage('media');
  };

  const handleNextFromMedia = () => {
    setStage('review');
  };

  // Submission handler
  const handleFinalSubmit = async () => {
    if (description.trim().length < 3) {
      setSubmitError('Please provide a description of at least 3 characters.');
      setStage('describe');
      return;
    }

    // REAL_MODE requires authenticated user
    if (!isDemoMode && !user) {
      setSubmitError('You must be signed in to submit a citizen report in REAL_MODE. Please sign in to continue.');
      return;
    }

    setStage('processing');
    setSubmitError(null);
    setProcessingStatusText('Submitting your report…');

    // Progress animation timers
    const timer1 = setTimeout(() => {
      setProcessingStatusText('Understanding your report…');
    }, 1200);

    const timer2 = setTimeout(() => {
      setProcessingStatusText('Checking for related public issues…');
    }, 2500);

    const timer3 = setTimeout(() => {
      setProcessingStatusText('Calculating public impact…');
    }, 4000);

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
        if (useManualEntry && manualLat.trim() && manualLng.trim()) {
          const lat = parseFloat(manualLat);
          const lng = parseFloat(manualLng);
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
        setProcessingStatusText('Attaching photo evidence…');
        const mediaRegRes = await apiClient.post<{
          data: { media_id: string; upload_url: string; storage_path: string };
        }>(`/api/v1/signals/${signal.id}/media`, {
          file_name: photoFile.name,
          mime_type: photoFile.type || 'image/jpeg',
          file_size_bytes: photoFile.size,
        });

        const { media_id, upload_url } = mediaRegRes.data;
        await apiClient.uploadFile(upload_url, photoFile, photoFile.type || 'image/jpeg');
        await apiClient.post(`/api/v1/signals/${signal.id}/media/${media_id}/complete`);
      }

      setCreatedSignal(signal);
      setStage('result');
    } catch (err: any) {
      if (err.status === 409 || err.code === 'CONFLICT') {
        setSubmitError('Duplicate report submission detected within cooldown window. Please wait before submitting identical reports.');
      } else if (err.status === 401 || err.code === 'UNAUTHORIZED') {
        setSubmitError('Your session has expired. Please sign in again.');
      } else if (err.status === 503 || err.code === 'AI_PROVIDER_UNAVAILABLE') {
        setSubmitError("CivicPulse's AI processing service is temporarily unavailable. Your report was not falsely marked as processed.");
      } else {
        setSubmitError(err.message || 'Failed to submit report. Please verify connection and retry.');
      }
      setStage('review');
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    }
  };

  const handleReset = () => {
    setCreatedSignal(null);
    setDescription(isDemoMode ? DEMO_DESCRIPTION_DEFAULT : '');
    handleRemovePhoto();
    setStage('describe');
    setSubmitError(null);
  };

  // Stepper steps configuration
  const steps = [
    { id: 'describe', label: 'Describe', stepNum: 1 },
    { id: 'location', label: 'Location', stepNum: 2 },
    { id: 'media', label: 'Media', stepNum: 3 },
    { id: 'review', label: 'Review', stepNum: 4 },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === stage);

  return (
    <CitizenShell>
      <div className="space-y-6 max-w-xl mx-auto">
        {/* Top Header / Back Link */}
        <div className="flex items-center justify-between">
          <Link
            href="/citizen"
            className="inline-flex items-center gap-1.5 text-xs text-ink-secondary hover:text-ink-primary font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </Link>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-ink-tertiary">
            <ShieldCheck className="w-3.5 h-3.5 text-civic-blue" />
            <span>DPDP Protected</span>
          </div>
        </div>

        {/* Page Title */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-ink-primary">
            Report a Public Issue
          </h1>
          <p className="text-xs text-ink-secondary">
            Citizen Signals → Government Intelligence → Public Action
          </p>
        </div>

        {/* REAL_MODE Unauthenticated Alert */}
        {!isDemoMode && !user && !authLoading && (
          <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-800">
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Authentication Required in REAL_MODE</span>
            </div>
            <p className="leading-relaxed">
              You must be signed in with a citizen account to submit real civic reports. Reports will be securely associated with your verified profile.
            </p>
            <div className="pt-1">
              <Link href="/login?redirect=/citizen/report">
                <Button variant="primary" size="sm" className="text-xs">
                  Sign In as Citizen
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Stepper Progress Bar (Stages 1 to 4) */}
        {stage !== 'processing' && stage !== 'result' && (
          <div className="pt-1 pb-2">
            <div className="flex items-center justify-between relative">
              <div className="absolute top-1/2 -translate-y-1/2 inset-x-0 h-0.5 bg-ink-border -z-0" />
              {steps.map((s, idx) => {
                const isCompleted = currentStepIndex > idx;
                const isCurrent = stage === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={currentStepIndex < idx}
                    onClick={() => setStage(s.id as ReportStage)}
                    className="relative z-10 flex flex-col items-center group cursor-pointer disabled:cursor-not-allowed"
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        isCompleted
                          ? 'bg-civic-blue text-white shadow-subtle'
                          : isCurrent
                          ? 'bg-white border-2 border-civic-blue text-civic-blue ring-4 ring-civic-blueLight'
                          : 'bg-canvas-subtle border border-ink-border text-ink-tertiary'
                      }`}
                    >
                      {isCompleted ? <Check className="w-3.5 h-3.5" /> : s.stepNum}
                    </div>
                    <span
                      className={`text-[10px] mt-1 font-medium transition-colors ${
                        isCurrent
                          ? 'text-civic-blue font-bold'
                          : isCompleted
                          ? 'text-ink-primary'
                          : 'text-ink-tertiary'
                      }`}
                    >
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Global Submit / Operational Error Banner */}
        {submitError && (
          <div className="p-3.5 rounded-xl border border-civic-rose/30 bg-rose-50 text-xs text-rose-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-civic-rose shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <div className="font-semibold">Submission Notice</div>
              <div className="leading-relaxed">{submitError}</div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 1: DESCRIBE                                                         */}
        {/* ========================================================================= */}
        {stage === 'describe' && (
          <div className="space-y-5 bg-white p-5 rounded-2xl border border-ink-border shadow-card">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-civic-blueLight text-civic-blue text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <h3 className="text-sm font-bold text-ink-primary">
                  Describe the Issue
                </h3>
              </div>
              <p className="text-xs text-ink-secondary pl-7">
                Describe what is happening, where it is happening, and how it is affecting people.
              </p>
            </div>

            {intakeMode === 'voice' && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-civic-blue shrink-0 mt-0.5" />
                <span>
                  Voice intake mode: You can dictate or paste plain speech in Odia (ଓଡ଼ିଆ), Hindi, or English. Gemini AI will structure and categorize it.
                </span>
              </div>
            )}

            <div className="space-y-2">
              <Textarea
                label="Problem Description"
                placeholder="Example: Broken water main pipe leaking heavily onto the road outside Block 4, creating flooded walkway and muddy hazards for commuters."
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (descriptionError && e.target.value.trim().length >= 3) {
                    setDescriptionError(null);
                  }
                }}
                rows={5}
              />
              <div className="flex items-center justify-between text-[11px] text-ink-secondary">
                <span>Minimum 3 characters</span>
                <span className={description.length > 4500 ? 'text-amber-600 font-bold' : ''}>
                  {description.length} / 5000 characters
                </span>
              </div>
              {descriptionError && (
                <p className="text-xs text-civic-rose font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{descriptionError}</span>
                </p>
              )}
            </div>

            <div className="p-3 rounded-xl bg-canvas-subtle border border-ink-border/60 text-[11px] text-ink-secondary space-y-1">
              <div className="font-semibold text-ink-primary">Helpful reporting tips:</div>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Mention nearby landmarks (e.g. crossing, market, school).</li>
                <li>Note severity (e.g. minor leak vs arterial flooding).</li>
                <li>No government codes or technical jargon required.</li>
              </ul>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                variant="primary"
                onClick={handleNextFromDescribe}
                className="gap-2 text-xs"
              >
                <span>Continue to Location</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 2: LOCATION                                                         */}
        {/* ========================================================================= */}
        {stage === 'location' && (
          <div className="space-y-5 bg-white p-5 rounded-2xl border border-ink-border shadow-card">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-civic-blueLight text-civic-blue text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <h3 className="text-sm font-bold text-ink-primary">
                  Incident Location
                </h3>
              </div>
              <p className="text-xs text-ink-secondary pl-7">
                Use your device GPS coordinates or enter manual coordinates / nearby landmark.
              </p>
            </div>

            {isDemoMode ? (
              /* DEMO_MODE: Preserves Ward 18 Golden Demo behavior */
              <div className="space-y-3">
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
                </div>
              </div>
            ) : (
              /* REAL_MODE: Real GPS + Manual fallback */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink-primary flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-civic-blue" />
                    <span>Real Incident Coordinates</span>
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
                        <span>Refresh GPS</span>
                      </>
                    )}
                  </button>
                </div>

                {/* GPS Status Visualizer */}
                {isLocating ? (
                  <div className="p-4 rounded-xl border border-ink-border bg-canvas-subtle text-xs flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin text-civic-blue shrink-0" />
                    <span className="text-ink-secondary">Requesting high-accuracy device coordinates via browser GPS…</span>
                  </div>
                ) : customCoordinates ? (
                  <div className="p-3.5 rounded-xl border border-civic-emerald/40 bg-emerald-50/50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                        <CheckCircle2 className="w-4 h-4 text-civic-emerald shrink-0" />
                        <span>Current Location (Browser GPS)</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                        GPS Locked
                      </span>
                    </div>
                    <div className="text-xs font-mono text-emerald-950 font-bold">
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
                        <span>GPS Coordinates Not Acquired</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRequestGeolocation}
                        className="text-xs text-civic-blue hover:underline font-semibold"
                      >
                        Retry GPS
                      </button>
                    </div>
                    <p className="text-[11px] text-amber-900/90 leading-relaxed">
                      {locationMessage || 'Browser location permission was not granted or signal timed out. Please enter coordinates or a landmark manually below.'}
                    </p>
                  </div>
                )}

                {/* Manual Coordinates / Landmark Fallback Section */}
                <div className="p-3.5 rounded-xl border border-ink-border bg-canvas-subtle space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink-primary">
                      {useManualEntry ? 'Location entered manually' : 'Manual Coordinates / Landmark Fallback'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setUseManualEntry(!useManualEntry)}
                      className="text-xs text-civic-blue hover:underline font-medium"
                    >
                      {useManualEntry ? 'Use GPS instead' : 'Enter manual coordinates'}
                    </button>
                  </div>

                  {(useManualEntry || !customCoordinates) && (
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
                            className="w-full text-xs font-mono p-2 rounded-lg border border-ink-border bg-white focus:outline-none focus:border-civic-blue"
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
                            className="w-full text-xs font-mono p-2 rounded-lg border border-ink-border bg-white focus:outline-none focus:border-civic-blue"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                          Landmark or Address Reference
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Near Damana Square, near Big Bazaar crossing"
                          value={manualLocationRef}
                          onChange={(e) => setManualLocationRef(e.target.value)}
                          className="w-full text-xs p-2 rounded-lg border border-ink-border bg-white focus:outline-none focus:border-civic-blue text-ink-primary"
                        />
                      </div>
                      <p className="text-[10px] text-ink-tertiary">
                        Municipal ward boundaries are authoritatively resolved on the server via BMC GIS polygon reference data.
                      </p>
                    </div>
                  )}
                </div>

                {locationError && (
                  <p className="text-xs text-civic-rose font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{locationError}</span>
                  </p>
                )}
              </div>
            )}

            <div className="pt-2 flex items-center justify-between">
              <Button
                variant="secondary"
                onClick={() => setStage('describe')}
                className="gap-1.5 text-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </Button>
              <Button
                variant="primary"
                onClick={handleNextFromLocation}
                className="gap-1.5 text-xs"
              >
                <span>Continue to Media</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 3: MEDIA                                                            */}
        {/* ========================================================================= */}
        {stage === 'media' && (
          <div className="space-y-5 bg-white p-5 rounded-2xl border border-ink-border shadow-card">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-civic-blueLight text-civic-blue text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <h3 className="text-sm font-bold text-ink-primary">
                  Attach Photo Evidence (Optional)
                </h3>
              </div>
              <p className="text-xs text-ink-secondary pl-7">
                Add an image of the civic issue. Maximum 10 MB (JPEG, PNG, WEBP, HEIC).
              </p>
            </div>

            <div className="space-y-3">
              {photoPreview ? (
                <div className="relative p-3 rounded-xl border border-ink-border bg-canvas-subtle flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoPreview}
                    alt="Uploaded photo preview"
                    className="w-20 h-20 rounded-lg object-cover border border-ink-border"
                  />
                  <div className="flex-1 text-xs truncate space-y-1">
                    <div className="font-semibold text-ink-primary truncate">{photoFile?.name}</div>
                    <div className="text-ink-secondary text-[11px]">
                      {(photoFile!.size / (1024 * 1024)).toFixed(2)} MB
                    </div>
                    <div className="text-[10px] text-civic-emerald font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Ready for upload</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="p-2 rounded-lg hover:bg-canvas text-ink-secondary hover:text-civic-rose transition-colors"
                    title="Remove Photo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 py-8 px-4 rounded-xl border-2 border-dashed border-ink-border hover:border-civic-blue bg-canvas-subtle/50 hover:bg-civic-blueLight/10 transition-all cursor-pointer text-center">
                  <div className="w-12 h-12 rounded-full bg-civic-blueLight text-civic-blue flex items-center justify-center">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-ink-primary block">
                      Click to choose photo or capture image
                    </span>
                    <span className="text-[11px] text-ink-secondary block">
                      Max file size: 10 MB (JPEG, PNG, WEBP, HEIC)
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />
                </label>
              )}

              {photoError && (
                <div className="text-xs text-civic-rose font-medium flex items-center gap-1.5 p-2 rounded-lg bg-rose-50 border border-rose-200">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{photoError}</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-between">
              <Button
                variant="secondary"
                onClick={() => setStage('location')}
                className="gap-1.5 text-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </Button>
              <Button
                variant="primary"
                onClick={handleNextFromMedia}
                className="gap-1.5 text-xs"
              >
                <span>Review Report</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 4: REVIEW                                                           */}
        {/* ========================================================================= */}
        {stage === 'review' && (
          <div className="space-y-5 bg-white p-5 rounded-2xl border border-ink-border shadow-card">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-civic-blueLight text-civic-blue text-xs font-bold flex items-center justify-center">
                  4
                </span>
                <h3 className="text-sm font-bold text-ink-primary">
                  Review Your Civic Report
                </h3>
              </div>
              <p className="text-xs text-ink-secondary pl-7">
                Confirm your report details before submitting to municipal intelligence intake.
              </p>
            </div>

            {/* Description Card */}
            <div className="p-3.5 rounded-xl border border-ink-border bg-canvas-subtle space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
                  Description
                </span>
                <button
                  type="button"
                  onClick={() => setStage('describe')}
                  className="text-xs text-civic-blue hover:underline font-medium flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              </div>
              <p className="text-xs text-ink-primary leading-relaxed">
                {description}
              </p>
            </div>

            {/* Location Card */}
            <div className="p-3.5 rounded-xl border border-ink-border bg-canvas-subtle space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
                  Location
                </span>
                <button
                  type="button"
                  onClick={() => setStage('location')}
                  className="text-xs text-civic-blue hover:underline font-medium flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink-primary">
                  {isDemoMode
                    ? selectedWard.name
                    : manualLocationRef ||
                      (customCoordinates
                        ? `${customCoordinates.lat.toFixed(4)}° N, ${customCoordinates.lng.toFixed(4)}° E`
                        : manualLat
                        ? `${manualLat}° N, ${manualLng}° E`
                        : 'Bhubaneswar (Municipal Area)')}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-canvas-muted text-ink-secondary border border-ink-border">
                  {isDemoMode
                    ? 'Demo Ward'
                    : customCoordinates && !useManualEntry
                    ? 'Current location (GPS)'
                    : 'Location entered manually'}
                </span>
              </div>
            </div>

            {/* Media Card */}
            <div className="p-3.5 rounded-xl border border-ink-border bg-canvas-subtle space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
                  Attached Media
                </span>
                <button
                  type="button"
                  onClick={() => setStage('media')}
                  className="text-xs text-civic-blue hover:underline font-medium flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              </div>
              {photoPreview ? (
                <div className="flex items-center gap-2 text-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoPreview}
                    alt="Preview thumbnail"
                    className="w-10 h-10 rounded-lg object-cover border border-ink-border"
                  />
                  <div className="truncate">
                    <span className="font-semibold text-ink-primary block truncate">{photoFile?.name}</span>
                    <span className="text-[10px] text-ink-secondary">
                      {(photoFile!.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>
                </div>
              ) : (
                <span className="text-xs text-ink-tertiary italic">No photo attached</span>
              )}
            </div>

            {/* AI Advisory Disclaimer */}
            <div className="p-3 rounded-xl border border-civic-blue/20 bg-civic-blueLight/20 text-[11px] text-ink-secondary space-y-1 leading-relaxed">
              <div className="flex items-center gap-1.5 font-semibold text-civic-blueDark">
                <Sparkles className="w-3.5 h-3.5 text-civic-blue" />
                <span>AI Categorization & Intelligence Ingestion</span>
              </div>
              <p>
                Upon submission, Google Gemini AI analyzes your report to detect civic category, language, and urgency. AI categorization is an advisory interpretation, not verified municipal fact. Official triage is performed by the municipal administration.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <Button
                variant="secondary"
                onClick={() => setStage('media')}
                className="gap-1.5 text-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </Button>
              <Button
                variant="primary"
                onClick={handleFinalSubmit}
                disabled={!isDemoMode && !user}
                className="gap-2 text-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{!isDemoMode && !user ? 'Sign in to Submit' : 'Submit Civic Report'}</span>
              </Button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 5 & 6: PROCESSING EXPERIENCE                                        */}
        {/* ========================================================================= */}
        {stage === 'processing' && (
          <div className="p-8 sm:p-12 rounded-2xl border border-ink-border bg-white shadow-card text-center space-y-6">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-civic-blueLight animate-ping opacity-30" />
              <div className="w-16 h-16 rounded-full bg-civic-blueLight text-civic-blue flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-civic-blue" />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-ink-primary">
                Processing Your Civic Report
              </h3>
              <p className="text-xs font-medium text-civic-blue animate-pulse">
                {processingStatusText}
              </p>
              <p className="text-[11px] text-ink-tertiary max-w-sm mx-auto leading-relaxed">
                Persisting to operational database, executing Gemini AI understanding, generating semantic embeddings, and checking for related public issues…
              </p>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 7: SUBMISSION RESULT                                                */}
        {/* ========================================================================= */}
        {stage === 'result' && createdSignal && (
          <div className="p-6 sm:p-8 rounded-2xl border border-civic-emerald/30 bg-white shadow-card space-y-6 text-center">
            <div className="w-14 h-14 rounded-full bg-civic-emeraldLight text-civic-emerald mx-auto flex items-center justify-center shadow-subtle">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-ink-primary">
                {createdSignal.cluster?.isNewCluster
                  ? 'New Public Problem Created'
                  : createdSignal.cluster?.matched
                  ? 'Correlated with Existing Public Problem'
                  : 'Report Successfully Submitted'}
              </h3>
              <p className="text-xs text-ink-secondary max-w-sm mx-auto leading-relaxed">
                {createdSignal.cluster?.isNewCluster
                  ? 'Your report established a new verified municipal problem cluster in the civic directory.'
                  : createdSignal.cluster?.matched
                  ? 'Your report was correlated with an existing neighborhood public problem cluster.'
                  : 'Your report has been securely logged and queued for operational municipal action.'}
              </p>
            </div>

            {/* Authoritative Response Details */}
            <div className="p-4 rounded-xl bg-canvas-subtle border border-ink-border text-left text-xs space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-ink-secondary">Signal Reference:</span>
                <span className="font-mono font-bold text-ink-primary">#{createdSignal.id}</span>
              </div>

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

              {createdSignal.cluster && (
                <div className="flex justify-between items-center">
                  <span className="text-ink-secondary">Relationship Status:</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                    {createdSignal.cluster.isNewCluster
                      ? 'New Public Problem Created'
                      : `Correlated (${createdSignal.cluster.relationship || 'Related'})`}
                  </span>
                </div>
              )}

              {createdSignal.cluster?.problem?.impact_score !== undefined && (
                <div className="flex justify-between items-center">
                  <span className="text-ink-secondary">Public Impact Score:</span>
                  <span className="font-mono font-bold text-civic-rose">
                    {createdSignal.cluster.problem.impact_score}/100 ({createdSignal.cluster.problem.impact_level || 'EVALUATED'})
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-ink-secondary">Ward / Location:</span>
                <span className="font-semibold text-ink-primary">
                  {isDemoMode
                    ? selectedWard.name
                    : createdSignal.ward_name ||
                      createdSignal.ward_id ||
                      (customCoordinates ? `${customCoordinates.lat.toFixed(4)}° N, ${customCoordinates.lng.toFixed(4)}° E` : 'Bhubaneswar')}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-ink-secondary">Status:</span>
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

            {/* AI Understanding Inspection Preview */}
            <div className="text-left">
              <SignalAIPreview
                signalId={createdSignal.id}
                initialProcessingStatus={createdSignal.ai_analysis ? 'COMPLETED' : 'PENDING'}
                initialAnalysis={createdSignal.ai_analysis || null}
              />
            </div>

            {/* CTAs */}
            <div className="pt-2 flex flex-col gap-2">
              <Link href="/citizen/issues" className="block w-full">
                <Button variant="primary" className="w-full">
                  Track My Report
                </Button>
              </Link>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs font-semibold text-civic-blue hover:underline py-1.5"
              >
                Report Another Issue
              </button>
            </div>
          </div>
        )}
      </div>
    </CitizenShell>
  );
}

export default function CitizenReportPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-canvas flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-civic-blue" />
        </div>
      }
    >
      <CitizenReportContent />
    </Suspense>
  );
}
