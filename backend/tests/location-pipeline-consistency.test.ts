import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ProviderContainer,
  getGeographyProvider,
  StaticGeographyProvider,
  MockDatabaseProvider,
  MockAIProvider
} from '../src/providers';
import { env } from '../src/config/env';
import { SignalService } from '../src/modules/signals/signal.service';
import { SignalRepository } from '../src/modules/signals/signal.repository';
import { ProblemService } from '../src/modules/problems/problem.service';
import { ProblemRepository } from '../src/modules/problems/problem.repository';
import { ClusteringService } from '../src/modules/clustering/clustering.service';
import {
  UserProfile,
  UserRole,
  UserStatus,
  ProblemStatus,
  SignalProcessingStatus
} from '@civicpulse/shared';

describe('Production Location Pipeline & Geometry Consistency', () => {
  const originalDemoMode = env.DEMO_MODE;
  let signalService: SignalService;
  let problemService: ProblemService;
  let clusteringService: ClusteringService;
  let signalRepo: SignalRepository;
  let problemRepo: ProblemRepository;

  const citizenUser: UserProfile = {
    id: 'usr_citizen_test_loc',
    email: 'citizen.test@civicpulse.org',
    display_name: 'Citizen Test User',
    role: UserRole.CITIZEN,
    status: UserStatus.ACTIVE,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const officerUser: UserProfile = {
    id: 'usr_officer_test_loc',
    email: 'officer.watco@civicpulse.org',
    display_name: 'WATCO Officer Test User',
    role: UserRole.DEPARTMENT_OFFICER,
    department_id: 'WATCO',
    status: UserStatus.ACTIVE,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  beforeEach(() => {
    (env as any).DEMO_MODE = false;
    ProviderContainer.resetAllProviders();
    ProviderContainer.setDatabaseProvider(new MockDatabaseProvider());
    ProviderContainer.setAIProvider(new MockAIProvider());
    signalService = new SignalService();
    problemService = new ProblemService();
    clusteringService = new ClusteringService();
    signalRepo = new SignalRepository();
    problemRepo = new ProblemRepository();
  });

  afterEach(() => {
    (env as any).DEMO_MODE = originalDemoMode;
    ProviderContainer.resetAllProviders();
  });

  it('1. Selected coordinates are preserved end-to-end without mutation', async () => {
    // Coordinates submitted for PRB-2026-8415: (20.317916, 85.818231)
    const selectedCoords = { lat: 20.317916, lng: 85.818231 };

    const signal = await signalService.createSignal(citizenUser, {
      original_text: 'Streeght light stopped working on the main stretch',
      location: selectedCoords,
      location_source: 'MANUAL',
      auto_process: false
    });

    expect(signal.location).toBeDefined();
    expect(signal.location?.lat).toBe(20.317916);
    expect(signal.location?.lng).toBe(85.818231);

    // Simulate completion of AI analysis
    await signalRepo.update(signal.id, {
      processing_status: SignalProcessingStatus.COMPLETED,
      category: 'STREET_LIGHTING'
    });

    const { problem } = await clusteringService.createClusterFromSignal(signal.id);
    expect(problem.location).toBeDefined();
    expect(problem.location?.lat).toBe(20.317916);
    expect(problem.location?.lng).toBe(85.818231);
  });

  it('2. Ward is calculated from selected coordinates using official 67-ward polygon geometry', async () => {
    const geoProvider = getGeographyProvider();
    expect(geoProvider).toBeInstanceOf(StaticGeographyProvider);

    // Selected coordinates: (20.317916, 85.818231)
    const ward = await geoProvider.getWardByCoordinates(20.317916, 85.818231);
    expect(ward).not.toBeNull();
    expect(ward?.ward_id).toBe('WARD-013');
    expect(ward?.ward_name).toBe('Ward 13 (North Zone)');
    expect(ward?.ward_number).toBe(13);
    expect(ward?.provenance).toBe('REAL');
  });

  it('3. Locality/ward name is not copied from unrelated/default location (Nayapalli / Ward 18)', async () => {
    const selectedCoords = { lat: 20.317916, lng: 85.818231 };

    const signal = await signalService.createSignal(citizenUser, {
      original_text: 'Water pipe leaking near market',
      location: selectedCoords,
      location_source: 'MANUAL',
      auto_process: false
    });

    expect(signal.ward_id).toBe('WARD-013');
    expect(signal.ward_name).toBe('Ward 13 (North Zone)');
    expect(signal.ward_name).not.toContain('Nayapalli');
    expect(signal.ward_id).not.toBe('WARD-018');

    // Test coordinates far outside BMC boundary: must resolve to undefined, NEVER default to Ward 18 or Nayapalli
    const outsideCoords = { lat: 28.6139, lng: 77.2090 }; // New Delhi
    const outsideSignal = await signalService.createSignal(citizenUser, {
      original_text: 'Issue outside municipal area',
      location: outsideCoords,
      location_source: 'MANUAL',
      auto_process: false
    });

    expect(outsideSignal.ward_id).toBeUndefined();
    expect(outsideSignal.ward_name).toBeUndefined();
    expect(outsideSignal.geography_provenance).toBe('UNKNOWN');
  });

  it('4. Problem details does not substitute centroid for submitted coordinates', async () => {
    const selectedCoords = { lat: 20.317916, lng: 85.818231 };

    const createdProblem = await problemRepo.create({
      id: 'PRB-2026-8415-TEST',
      title: 'Streeght light stopped working',
      category: 'ELECTRICAL',
      department_id: 'WATCO',
      ward_id: 'WARD-013',
      location: selectedCoords,
      status: ProblemStatus.TRIAGED,
      signal_count: 1,
      impact_score: 45,
      impact_level: 'MEDIUM' as any,
      severity_score: 15,
      population_score: 10,
      duration_score: 5,
      concentration_score: 5,
      critical_exposure_score: 0,
      recurrence_score: 5,
      evidence_score: 3,
      first_detected_at: new Date().toISOString(),
      last_updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    const details = await problemService.getProblemDetails(officerUser, createdProblem.id);

    // Report Source Coordinates must strictly remain the submitted point
    expect(details.location).toBeDefined();
    expect(details.location?.lat).toBe(20.317916);
    expect(details.location?.lng).toBe(85.818231);

    // Derived Ward Centroid must be present and distinct from submitted coordinates
    expect(details.ward_name).toBe('Ward 13 (North Zone)');
    expect(details.ward_centroid).toBeDefined();
    expect(details.ward_centroid?.lat).toBeCloseTo(20.319966, 4);
    expect(details.ward_centroid?.lng).toBeCloseTo(85.814967, 4);

    // Coordinates must not be equal to ward centroid
    expect(details.location?.lat).not.toBe(details.ward_centroid?.lat);
    expect(details.location?.lng).not.toBe(details.ward_centroid?.lng);
  });

  it('5. Changing the selected map point changes the resulting ward when crossing boundaries', async () => {
    const geo = getGeographyProvider();

    // Point in Ward 13 (North Zone)
    const ward13 = await geo.getWardByCoordinates(20.317916, 85.818231);
    expect(ward13?.ward_id).toBe('WARD-013');
    expect(ward13?.ward_name).toBe('Ward 13 (North Zone)');

    // Point in Ward 27 (South-West Zone)
    const ward27 = await geo.getWardByCoordinates(20.2961, 85.8245);
    expect(ward27?.ward_id).toBe('WARD-027');
    expect(ward27?.ward_name).toBe('Ward 27 (South-West Zone)');

    // Point in Ward 6 (North Zone)
    const ward6 = await geo.getWardByCoordinates(20.3540, 85.8180);
    expect(ward6?.ward_id).toBe('WARD-006');
    expect(ward6?.ward_name).toBe('Ward 6 (North Zone)');

    // All distinct across ward boundaries
    expect(ward13?.ward_id).not.toBe(ward27?.ward_id);
    expect(ward13?.ward_id).not.toBe(ward6?.ward_id);
    expect(ward27?.ward_id).not.toBe(ward6?.ward_id);
  });
});
