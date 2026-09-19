'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CitizenShell } from '../../../components/shells/CitizenShell';
import {
  Camera,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Send,
  X,
  AlertCircle,
  Loader2,
  Lock,
  Sparkles,
  Info,
  Edit3,
  ShieldCheck
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import { apiClient } from '../../../lib/api-client';
import { SignalAIPreview } from '../../../components/citizen/SignalAIPreview';
import { LocationPicker, LocationPickerValue } from '../../../components/domain/LocationPicker';
import { useAuth } from '../../../context/AuthContext';

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB Canonical MVP Limit
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

type ReportStage = 'describe' | 'location' | 'media' | 'review' | 'processing' | 'result';

function CitizenReportContent() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const intakeMode = searchParams.get('mode') || 'text';

  const [stage, setStage] = useState<ReportStage>('describe');

  // Stage 1: Description state
  const [description, setDescription] = useState('');
  const [descriptionError, setDescriptionError] = useState<string | null>(null);

// Stage 2: Location state
  // Initialized to null to guarantee that initial visual fallback center coordinates
  // are NEVER submitted automatically without explicit user selection/confirmation.
  const [selectedLocation, setSelectedLocation] = useState<LocationPickerValue | null>(null);
  const [manualLocationRef, setManualLocationRef] = useState<string>('');
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
    if (!selectedLocation || typeof selectedLocation.lat !== 'number' || typeof selectedLocation.lng !== 'number') {
      setLocationError('Please position the pin on the map or click Confirm Location before continuing.');
      return;
    }
    if (
      selectedLocation.lat < -90 ||
      selectedLocation.lat > 90 ||
      selectedLocation.lng < -180 ||
      selectedLocation.lng > 180
    ) {
      setLocationError('Coordinates out of valid range (-90 to 90 lat, -180 to 180 lng).');
      return;
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

    // Requires authenticated user
    if (!user) {
      setSubmitError('You must be signed in to submit a citizen report. Please sign in to continue.');
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

      if (selectedLocation) {
        activeCoords = {
          lat: selectedLocation.lat,
          lng: selectedLocation.lng,
        };
      }

      if (manualLocationRef.trim()) {
        locationRef = manualLocationRef.trim();
      }

      // ward_id is resolved by backend IGeographyProvider from coordinates
      wardId = undefined;

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
          location_source: selectedLocation?.source || 'MANUAL',
          location_accuracy_m: selectedLocation?.accuracy_m,
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
    setDescription('');
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

        {/* Unauthenticated Alert */}
        {!user && !authLoading && (
          <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-800">
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Authentication Required</span>
            </div>
            <p className="leading-relaxed">
              You must be signed in with a citizen account to submit civic reports. Reports will be securely associated with your verified profile.
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

        {/* Document Header & Form Track */}
        {stage !== 'processing' && stage !== 'result' && (
          <div className="border-b border-ink-border pb-4 space-y-3">
            <div className="flex items-center justify-between text-[10px] font-mono text-ink-tertiary uppercase tracking-widest">
              <span>FORM REF: CP-INT-01 // PUBLIC SERVICE INTAKE</span>
              <span>STEP {currentStepIndex + 1} OF {steps.length}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {steps.map((s, idx) => {
                const isCompleted = currentStepIndex > idx;
                const isCurrent = stage === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={currentStepIndex < idx}
                    onClick={() => setStage(s.id as ReportStage)}
                    className={`p-2.5 rounded-sm border text-left transition-colors font-mono disabled:cursor-not-allowed ${
                      isCurrent
                        ? 'border-civic-terracotta bg-canvas-card text-ink-primary'
                        : isCompleted
                        ? 'border-ink-border bg-canvas-subtle/50 text-ink-secondary'
                        : 'border-ink-border/50 bg-canvas text-ink-tertiary opacity-60'
                    }`}
                  >
                    <div className="text-[9px] uppercase tracking-wider font-semibold text-civic-terracotta">
                      0{s.stepNum}
                    </div>
                    <div className="text-xs font-semibold truncate">
                      {s.label}
                    </div>
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
          <div className="space-y-5 bg-canvas-card p-6 rounded-sm border border-ink-border shadow-none">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-sm bg-canvas-subtle border border-ink-border text-civic-terracotta text-xs font-mono font-bold flex items-center justify-center">
                  1
                </span>
                <h3 className="text-sm font-bold text-ink-primary uppercase tracking-wider font-mono">
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
          <div className="space-y-5 bg-canvas-card p-6 rounded-sm border border-ink-border shadow-none">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-sm bg-canvas-subtle border border-ink-border text-civic-terracotta text-xs font-mono font-bold flex items-center justify-center">
                  2
                </span>
                <h3 className="text-sm font-bold text-ink-primary uppercase tracking-wider font-mono">
                  Incident Location
                </h3>
              </div>
              <p className="text-xs text-ink-secondary pl-7">
                Place the pin on the real map or use your device location to position the civic incident accurately.
              </p>
            </div>

            {/* REAL INTERACTIVE MAP LOCATION PICKER */}
            <LocationPicker
              initialValue={selectedLocation}
              onChange={(val) => {
                setSelectedLocation(val);
                setLocationError(null);
              }}
              onConfirm={(val) => {
                setSelectedLocation(val);
                setLocationError(null);
              }}
            />

            {/* OPTIONAL LANDMARK / DESCRIPTIVE REFERENCE */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-[11px] font-mono uppercase tracking-wider text-ink-secondary">
                Nearby Landmark or Address Reference (Optional)
              </label>
              <Input
                type="text"
                placeholder="e.g. Near Damana Square, opposite Post Office, VIP Road"
                value={manualLocationRef}
                onChange={(e) => setManualLocationRef(e.target.value)}
                className="text-xs"
              />
              <p className="text-[10px] text-ink-tertiary font-mono">
                Municipal ward jurisdiction is authoritatively resolved on the server via BMC GIS polygon reference data.
              </p>
            </div>

            {locationError && (
              <p className="text-xs text-civic-rose font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{locationError}</span>
              </p>
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
          <div className="space-y-5 bg-canvas-card p-6 rounded-sm border border-ink-border shadow-none">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-sm bg-canvas-subtle border border-ink-border text-civic-terracotta text-xs font-mono font-bold flex items-center justify-center">
                  3
                </span>
                <h3 className="text-sm font-bold text-ink-primary uppercase tracking-wider font-mono">
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
          <div className="space-y-5 bg-canvas-card p-6 rounded-sm border border-ink-border shadow-none">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-sm bg-canvas-subtle border border-ink-border text-civic-terracotta text-xs font-mono font-bold flex items-center justify-center">
                  4
                </span>
                <h3 className="text-sm font-bold text-ink-primary uppercase tracking-wider font-mono">
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
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-bold text-ink-primary">
                  {selectedLocation
                    ? `${selectedLocation.lat.toFixed(5)}° N, ${selectedLocation.lng.toFixed(5)}° E`
                    : 'Bhubaneswar (Municipal Area)'}
                  {manualLocationRef ? ` (${manualLocationRef})` : ''}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-xs bg-canvas-card text-ink-secondary border border-ink-border uppercase">
                  {selectedLocation?.source === 'GPS'
                    ? `GPS${selectedLocation.accuracy_m ? ` (±${selectedLocation.accuracy_m}m)` : ''}`
                    : 'Manual Pin'}
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
                disabled={!user}
                className="gap-2 text-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{!user ? 'Sign in to Submit' : 'Submit Civic Report'}</span>
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
                  {createdSignal.ward_name ||
                    createdSignal.ward_id ||
                    (selectedLocation ? `${selectedLocation.lat.toFixed(4)}° N, ${selectedLocation.lng.toFixed(4)}° E` : 'Bhubaneswar')}
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
