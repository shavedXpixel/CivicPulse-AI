import {
  UserProfile,
  CitizenProfile,
  Signal,
  SignalMediaItem,
  AIOperationRecord,
  ProblemCluster,
  ProblemClusterMember,
  UserRole,
  UserStatus,
  SignalSeverity,
  SignalStatus,
  SignalProcessingStatus,
  SignalSourceType,
  ProblemStatus,
  ImpactLevel,
  ClusterRelationshipType,
  Assignment,
  AssignmentPriority,
  AssignmentStatus,
  ProblemAction,
  ActionType,
  Department,
  DepartmentWorkload,
  ERROR_CODES,
  ResolutionEvidence,
  VerificationResult,
  EvidenceType,
  BeforeOrAfter,
  EvidenceStatus,
  VerificationResultStatus
} from '@civicpulse/shared';
import { IDatabaseProvider, SignalFilterCriteria, ProblemFilterCriteria } from './database.interface';
import { AppError } from '../../middleware/error.middleware';

export class MockDatabaseProvider implements IDatabaseProvider {
  private users = new Map<string, UserProfile>();
  private citizenProfiles = new Map<string, CitizenProfile>();
  private signals = new Map<string, Signal>();
  private signalMedia = new Map<string, SignalMediaItem[]>();
  private aiOperations = new Map<string, AIOperationRecord[]>();
  private problemClusters = new Map<string, ProblemCluster>();
  private problemClusterMembers = new Map<string, ProblemClusterMember[]>();
  private assignments = new Map<string, Assignment[]>();
  private actions = new Map<string, ProblemAction[]>();
  private departments = new Map<string, Department>();
  private resolutionEvidence = new Map<string, ResolutionEvidence[]>();
  private verificationResults = new Map<string, VerificationResult[]>();

  constructor() {
    this.seedMinimalFixtures();
  }

  private seedMinimalFixtures() {
    // 1. Demo Citizen
    const citizenUser: UserProfile = {
      id: 'usr_citizen_01',
      email: 'citizen.aarav@example.com',
      display_name: 'Aarav Patnaik',
      role: UserRole.CITIZEN,
      status: UserStatus.ACTIVE,
      ward_id: 'WARD-018',
      created_at: '2026-09-01T08:00:00Z',
      updated_at: '2026-09-01T08:00:00Z'
    };
    this.users.set(citizenUser.id, citizenUser);

    const citizenProfile: CitizenProfile = {
      id: 'prof_citizen_01',
      user_id: citizenUser.id,
      preferred_language: 'od',
      default_ward_id: 'WARD-018',
      notification_enabled: true,
      created_at: '2026-09-01T08:00:00Z',
      updated_at: '2026-09-01T08:00:00Z'
    };
    this.citizenProfiles.set(citizenUser.id, citizenProfile);

    // 2. Demo Field Officer
    const officerUser: UserProfile = {
      id: 'usr_officer_01',
      email: 'officer.manoj@watco.odisha.gov.in',
      display_name: 'Manoj Mohanty',
      role: UserRole.FIELD_OFFICER,
      status: UserStatus.ACTIVE,
      department_id: 'WATCO',
      created_at: '2026-09-01T08:00:00Z',
      updated_at: '2026-09-01T08:00:00Z'
    };
    this.users.set(officerUser.id, officerUser);

    // 3. Demo Admin
    const adminUser: UserProfile = {
      id: 'usr_admin_01',
      email: 'commissioner@bmc.gov.in',
      display_name: 'Bhubaneswar Municipal Commissioner',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      created_at: '2026-09-01T08:00:00Z',
      updated_at: '2026-09-01T08:00:00Z'
    };
    this.users.set(adminUser.id, adminUser);

    // 4. Secondary Citizen (used strictly to test ownership isolation)
    const secondCitizen: UserProfile = {
      id: 'usr_citizen_02',
      email: 'citizen.priya@example.com',
      display_name: 'Priya Dash',
      role: UserRole.CITIZEN,
      status: UserStatus.ACTIVE,
      ward_id: 'WARD-004',
      created_at: '2026-09-02T09:00:00Z',
      updated_at: '2026-09-02T09:00:00Z'
    };
    this.users.set(secondCitizen.id, secondCitizen);

    // 4b. Department & Field Officers for strict authorization scoping tests
    const deptOfficerWatco: UserProfile = {
      id: 'usr_dept_watco',
      email: 'subrat.jena@watco.odisha.gov.in',
      display_name: 'Er. Subrat Jena (WATCO Officer)',
      role: UserRole.DEPARTMENT_OFFICER,
      status: UserStatus.ACTIVE,
      department_id: 'WATCO',
      created_at: '2026-09-01T08:00:00Z',
      updated_at: '2026-09-01T08:00:00Z'
    };
    this.users.set(deptOfficerWatco.id, deptOfficerWatco);

    const deptOfficerDrainage: UserProfile = {
      id: 'usr_dept_drainage',
      email: 'alok.nayak@bmc.gov.in',
      display_name: 'Dr. Alok Nayak (BMC Drainage Officer)',
      role: UserRole.DEPARTMENT_OFFICER,
      status: UserStatus.ACTIVE,
      department_id: 'BMC_DRAINAGE',
      created_at: '2026-09-01T08:00:00Z',
      updated_at: '2026-09-01T08:00:00Z'
    };
    this.users.set(deptOfficerDrainage.id, deptOfficerDrainage);

    const fieldOfficerDrainage: UserProfile = {
      id: 'usr_field_drainage',
      email: 'bikram.rout@bmc.gov.in',
      display_name: 'Bikram Rout (BMC Drainage Field Officer)',
      role: UserRole.FIELD_OFFICER,
      status: UserStatus.ACTIVE,
      department_id: 'BMC_DRAINAGE',
      created_at: '2026-09-01T08:00:00Z',
      updated_at: '2026-09-01T08:00:00Z'
    };
    this.users.set(fieldOfficerDrainage.id, fieldOfficerDrainage);

    // 4c. Municipal Departments Directory
    const depts: Department[] = [
      {
        id: 'WATCO',
        name: 'Water Corporation of Odisha',
        short_name: 'WATCO',
        description: 'Potable water supply, bulk distribution pipelines, domestic water connections, and water infrastructure maintenance.',
        lead_officer: 'Er. Subrat Jena (Superintending Engineer)',
        contact_phone: '+91 674 254 1234',
        contact_email: 'operations@watco.odisha.gov.in',
        jurisdiction_wards: [1, 2, 3, 4, 18, 19, 20, 21, 22, 23, 24, 25]
      },
      {
        id: 'BMC_DRAINAGE',
        name: 'BMC Drainage & Sewerage Division',
        short_name: 'BMC Drainage',
        description: 'Stormwater arterial drains, culvert desilting, local drainage channels, and municipal flood prevention.',
        lead_officer: 'Er. Alok Nayak (Executive Engineer)',
        contact_phone: '+91 674 254 5678',
        contact_email: 'drainage@bmc.gov.in',
        jurisdiction_wards: [1, 2, 3, 4, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28]
      },
      {
        id: 'BMC_ROADS',
        name: 'BMC Engineering & Works (Roads)',
        short_name: 'BMC Roads',
        description: 'Municipal roads, pavement restoration, pothole remediation, and pedestrian walkways across Bhubaneswar.',
        lead_officer: 'Er. Rashmi Ranjan Ray',
        contact_phone: '+91 674 254 9900',
        contact_email: 'works@bmc.gov.in',
        jurisdiction_wards: [1, 2, 3, 4, 18, 19, 20, 21]
      },
      {
        id: 'BMC_SAN',
        name: 'BMC Solid Waste Management & Sanitation',
        short_name: 'BMC Sanitation',
        description: 'Decentralized solid waste management, door-to-door collection, micro-composting centers (MCC), and street sweeping.',
        lead_officer: 'Dr. Sibananda Mishra',
        contact_phone: '+91 674 254 3322',
        contact_email: 'sanitation@bmc.gov.in',
        jurisdiction_wards: [1, 2, 3, 4, 18, 19, 20, 21, 22, 23]
      },
      {
        id: 'TPCODL',
        name: 'TP Central Odisha Distribution Limited',
        short_name: 'TPCODL',
        description: 'Power distribution, high/low tension transmission lines, streetlighting, and public transformer safety.',
        lead_officer: 'Er. Niranjan Das',
        contact_phone: '+91 674 254 7788',
        contact_email: 'customercare@tpcentralodisha.com',
        jurisdiction_wards: [1, 2, 3, 4, 18, 19, 20, 21, 22, 23, 24, 25]
      }
    ];
    for (const d of depts) {
      this.departments.set(d.id, d);
    }

    // 5. Minimal Signals for usr_citizen_01 history and clustering testing
    const sig1: Signal = {
      id: 'sig_1001',
      source_type: SignalSourceType.CITIZEN,
      citizen_id: 'usr_citizen_01',
      original_text: 'Water supply pipeline bursting on Nayapalli VIP Road, submerging basement driveways.',
      category: 'water_supply',
      ward_id: 'WARD-018',
      location: { lat: 20.2961, lng: 85.8245 },
      location_reference: 'VIP Road, Jayadev Vihar Crossing',
      severity: SignalSeverity.HIGH,
      status: SignalStatus.ATTACHED_TO_PROBLEM,
      problem_cluster_id: 'PRB-2026-0819',
      processing_status: SignalProcessingStatus.COMPLETED,
      recommended_department: 'WATCO',
      created_at: '2026-09-05T06:30:00Z',
      updated_at: '2026-09-05T06:30:00Z',
      submitted_at: '2026-09-05T06:30:00Z',
      media_ids: []
    };
    this.signals.set(sig1.id, sig1);

    const sig2: Signal = {
      id: 'sig_1002',
      source_type: SignalSourceType.CITIZEN,
      citizen_id: 'usr_citizen_01',
      original_text: 'Flickering streetlights outside Government High School, Nayapalli.',
      category: 'streetlights',
      ward_id: 'WARD-018',
      location: { lat: 20.2945, lng: 85.821 },
      location_reference: 'Near Govt High School, Ward 18',
      severity: SignalSeverity.LOW,
      status: SignalStatus.ACTIVE,
      processing_status: SignalProcessingStatus.COMPLETED,
      recommended_department: 'TPCODL',
      created_at: '2026-09-04T18:15:00Z',
      updated_at: '2026-09-04T18:15:00Z',
      submitted_at: '2026-09-04T18:15:00Z',
      media_ids: []
    };
    this.signals.set(sig2.id, sig2);

    // Representative member signal 2 for Golden Demo
    const sig3: Signal = {
      id: 'sig_1003',
      source_type: SignalSourceType.CITIZEN,
      citizen_id: 'usr_citizen_01',
      original_text: 'Basement flooding and zero drinking water pressure on VIP Road Nayapalli for two days.',
      category: 'water_supply',
      ward_id: 'WARD-018',
      location: { lat: 20.2965, lng: 85.8248 },
      location_reference: 'VIP Road Plot 12B',
      severity: SignalSeverity.HIGH,
      status: SignalStatus.ATTACHED_TO_PROBLEM,
      problem_cluster_id: 'PRB-2026-0819',
      processing_status: SignalProcessingStatus.COMPLETED,
      recommended_department: 'WATCO',
      created_at: '2026-09-05T08:00:00Z',
      updated_at: '2026-09-05T08:00:00Z',
      submitted_at: '2026-09-05T08:00:00Z',
      media_ids: []
    };
    this.signals.set(sig3.id, sig3);

    // Representative member signal 3 for Golden Demo (Near school)
    const sig4: Signal = {
      id: 'sig_1004',
      source_type: SignalSourceType.CITIZEN,
      citizen_id: 'usr_citizen_01',
      original_text: 'Drinking water pipeline leakage impacting DAV Public School gate entrance Nayapalli.',
      category: 'water_supply',
      ward_id: 'WARD-018',
      location: { lat: 20.2970, lng: 85.8252 },
      location_reference: 'Near DAV Public School Gate 2',
      severity: SignalSeverity.HIGH,
      critical_facility: 'DAV Public School',
      status: SignalStatus.ATTACHED_TO_PROBLEM,
      problem_cluster_id: 'PRB-2026-0819',
      processing_status: SignalProcessingStatus.COMPLETED,
      recommended_department: 'WATCO',
      created_at: '2026-09-05T09:30:00Z',
      updated_at: '2026-09-05T09:30:00Z',
      submitted_at: '2026-09-05T09:30:00Z',
      media_ids: []
    };
    this.signals.set(sig4.id, sig4);

    // 6. Isolated Signal for usr_citizen_02 (Citizen 1 must NOT be able to read this)
    const isolatedSig: Signal = {
      id: 'sig_isolated_99',
      source_type: SignalSourceType.CITIZEN,
      citizen_id: 'usr_citizen_02',
      original_text: 'Private noise complaint from resident in Saheed Nagar Block B.',
      category: 'sanitation',
      ward_id: 'WARD-004',
      location: { lat: 20.2882, lng: 85.8436 },
      location_reference: 'Saheed Nagar Block B',
      severity: SignalSeverity.LOW,
      status: SignalStatus.ACTIVE,
      processing_status: SignalProcessingStatus.PENDING,
      created_at: '2026-09-06T11:00:00Z',
      updated_at: '2026-09-06T11:00:00Z',
      submitted_at: '2026-09-06T11:00:00Z',
      media_ids: []
    };
    this.signals.set(isolatedSig.id, isolatedSig);

    // 7. GOLDEN DEMO SCENARIO: PRB-2026-0819
    // Underlying factor scores: Severity 24, Population 18, Duration 14, Concentration 14, Critical Exposure 9, Recurrence 8, Evidence 5
    // Deterministic sum = 24 + 18 + 14 + 14 + 9 + 8 + 5 = 92/100 (CRITICAL)
    const goldenProblem: ProblemCluster = {
      id: 'PRB-2026-0819',
      title: 'Water Supply Disruption — Nayapalli Ward 18',
      description: 'Potable water transmission main rupture causing localized flooding and supply outage across Nayapalli corridor.',
      category: 'water_supply',
      subcategory: 'pipeline_rupture',
      department_id: 'WATCO', // Pre-seeded reference metadata for presentation
      assigned_to: 'usr_officer_01',
      assigned_at: '2026-09-04T08:30:00Z',
      ward_id: 'WARD-018',
      location: { lat: 20.2961, lng: 85.8245 },
      status: ProblemStatus.IN_PROGRESS,
      signal_count: 327, // Aggregate synthetic demo count
      supporting_media_count: 42, // Aggregate synthetic demo count
      estimated_population: 18400,
      duration_days: 3,
      severity_score: 24,
      population_score: 18,
      duration_score: 14,
      concentration_score: 14,
      critical_exposure_score: 9,
      recurrence_score: 8,
      evidence_score: 5,
      impact_score: 92,
      impact_level: ImpactLevel.CRITICAL,
      impact_explanation: 'This problem is critical impact (92/100) primarily driven by severe water main rupture (24/25), high report concentration across Nayapalli corridor (14/15), 3-day outage duration (14/15), and direct exposure near DAV Public School (9/10).',
      confidence: 0.94,
      first_detected_at: '2026-09-04T08:00:00Z',
      last_updated_at: '2026-09-07T00:30:00Z',
      created_at: '2026-09-04T08:00:00Z',
      updated_at: '2026-09-07T00:30:00Z',
      is_demo: true
    };
    this.problemClusters.set(goldenProblem.id, goldenProblem);

    // Golden Demo representative members
    const goldenMembers: ProblemClusterMember[] = [
      {
        id: 'mem_1001',
        problem_id: goldenProblem.id,
        signal_id: sig1.id,
        relationship: ClusterRelationshipType.DUPLICATE,
        similarity: 0.94,
        reason: 'Same water_supply category, identical corridor coordinates, matching rupture description',
        created_at: '2026-09-05T06:35:00Z'
      },
      {
        id: 'mem_1003',
        problem_id: goldenProblem.id,
        signal_id: sig3.id,
        relationship: ClusterRelationshipType.DUPLICATE,
        similarity: 0.89,
        reason: 'Matching basement flooding and zero potable water pressure within 180m',
        created_at: '2026-09-05T08:05:00Z'
      },
      {
        id: 'mem_1004',
        problem_id: goldenProblem.id,
        signal_id: sig4.id,
        relationship: ClusterRelationshipType.RELATED,
        similarity: 0.78,
        reason: 'Proximity near DAV Public School, same water distribution zone',
        created_at: '2026-09-05T09:35:00Z'
      }
    ];
    this.problemClusterMembers.set(goldenProblem.id, goldenMembers);

    // Golden Demo Assignment & Actions
    const goldenAssignment: Assignment = {
      id: 'asgn_demo_watco_01',
      problem_id: goldenProblem.id,
      department_id: 'WATCO',
      assigned_to: 'usr_officer_01',
      assigned_by: 'usr_admin_01',
      priority: AssignmentPriority.CRITICAL,
      status: AssignmentStatus.ASSIGNED,
      assigned_at: '2026-09-04T08:30:00Z',
      due_at: '2026-09-05T08:30:00Z',
      notes: 'Emergency pipeline rupture near Nayapalli sub-station. Coordinate with Ward 18 engineer.',
      created_at: '2026-09-04T08:30:00Z',
      updated_at: '2026-09-04T08:30:00Z'
    };
    this.assignments.set(goldenProblem.id, [goldenAssignment]);

    const goldenActions: ProblemAction[] = [
      {
        id: 'act_demo_01',
        problem_id: goldenProblem.id,
        actor_id: 'SYSTEM',
        actor_role: 'SYSTEM',
        action_type: ActionType.CREATED,
        new_state: ProblemStatus.NEW,
        note: 'Problem cluster synthesized from citizen signals with initial 92/100 impact score.',
        created_at: '2026-09-04T08:00:00Z'
      },
      {
        id: 'act_demo_02',
        problem_id: goldenProblem.id,
        actor_id: 'usr_admin_01',
        actor_role: 'ADMIN',
        action_type: ActionType.TRIAGED,
        previous_state: ProblemStatus.NEW,
        new_state: ProblemStatus.TRIAGED,
        note: 'Validated as critical municipal water disruption along Nayapalli corridor.',
        created_at: '2026-09-04T08:15:00Z'
      },
      {
        id: 'act_demo_03',
        problem_id: goldenProblem.id,
        actor_id: 'usr_admin_01',
        actor_role: 'ADMIN',
        action_type: ActionType.ASSIGNED,
        previous_state: ProblemStatus.TRIAGED,
        new_state: ProblemStatus.ASSIGNED,
        target_department_id: 'WATCO',
        target_officer_id: 'usr_officer_01',
        note: 'Assigned to WATCO field engineering crew with 24-hour critical SLA.',
        created_at: '2026-09-04T08:30:00Z'
      },
      {
        id: 'act_demo_04',
        problem_id: goldenProblem.id,
        actor_id: 'usr_officer_01',
        actor_role: 'FIELD_OFFICER',
        action_type: ActionType.STARTED_WORK,
        previous_state: ProblemStatus.ASSIGNED,
        new_state: ProblemStatus.IN_PROGRESS,
        note: 'Excavation team mobilized to isolate main gate valve on Nayapalli road.',
        created_at: '2026-09-04T09:15:00Z'
      }
    ];
    this.actions.set(goldenProblem.id, goldenActions);

    // Golden Demo Resolution Evidence for PRB-2026-0819
    const goldenEvidenceBefore: ResolutionEvidence = {
      id: 'evd_demo_0819_before',
      problem_id: goldenProblem.id,
      submitted_by: 'usr_citizen_01',
      submitted_at: '2026-09-04T08:05:00Z',
      evidence_type: EvidenceType.COMPLETION_PHOTO,
      storage_path: 'mock://evidence/prb_0819_before_rupture.jpg',
      media_type: 'image/jpeg',
      description: 'Severe potable water main rupture causing gushing surface flood and low water pressure across Nayapalli.',
      location: { lat: 20.2961, lng: 85.8245, reference: 'VIP Road, Nayapalli Ward 18' },
      observed_at: '2026-09-04T08:00:00Z',
      before_or_after: BeforeOrAfter.BEFORE,
      status: EvidenceStatus.SUBMITTED,
      is_demo: true,
      created_at: '2026-09-04T08:05:00Z'
    };

    const goldenEvidenceAfter: ResolutionEvidence = {
      id: 'evd_demo_0819_after',
      problem_id: goldenProblem.id,
      submitted_by: 'usr_officer_01',
      submitted_at: '2026-09-06T14:30:00Z',
      evidence_type: EvidenceType.COMPLETION_PHOTO,
      storage_path: 'mock://evidence/prb_0819_after_repair.jpg',
      media_type: 'image/jpeg',
      description: 'Emergency excavation completed. High-pressure 250mm DI flange pipe joint replaced, bolted, and hydrostatic pressure tested at 3.8 bar. Trench backfilled and asphalt road surface cleared of standing water.',
      location: { lat: 20.2961, lng: 85.8245, reference: 'Nayapalli Junction, Ward 18' },
      observed_at: '2026-09-06T14:15:00Z',
      before_or_after: BeforeOrAfter.AFTER,
      status: EvidenceStatus.SUBMITTED,
      is_demo: true,
      created_at: '2026-09-06T14:30:00Z'
    };

    this.resolutionEvidence.set(goldenProblem.id, [goldenEvidenceBefore, goldenEvidenceAfter]);

    // 8. Secondary Ranked Clusters for Multi-Issue Prioritization Demonstration
    const problem2: ProblemCluster = {
      id: 'PRB-2026-0820',
      title: 'Primary Stormwater Drain Collapse & Backflow',
      description: 'Major arterial stormwater drain culvert obstruction causing street inundation.',
      category: 'drainage',
      subcategory: 'drain_collapse',
      department_id: 'BMC_DRAINAGE',
      assigned_to: 'usr_field_drainage',
      assigned_at: '2026-09-05T10:30:00Z',
      ward_id: 'WARD-004',
      location: { lat: 20.2882, lng: 85.8436 },
      status: ProblemStatus.ASSIGNED,
      signal_count: 84,
      supporting_media_count: 14,
      estimated_population: 12500,
      duration_days: 2,
      severity_score: 22,
      population_score: 16,
      duration_score: 12,
      concentration_score: 13,
      critical_exposure_score: 8,
      recurrence_score: 10,
      evidence_score: 5,
      impact_score: 86,
      impact_level: ImpactLevel.CRITICAL,
      impact_explanation: 'High recurring drain failure with heavy stormwater overflow affecting Janpath commercial sector.',
      confidence: 0.91,
      first_detected_at: '2026-09-05T10:00:00Z',
      last_updated_at: '2026-09-06T19:00:00Z',
      created_at: '2026-09-05T10:00:00Z',
      updated_at: '2026-09-06T19:00:00Z',
      is_demo: true
    };
    this.problemClusters.set(problem2.id, problem2);

    const problem3: ProblemCluster = {
      id: 'PRB-2026-0821',
      title: 'Subsurface Road Cavity & Subsidence — Khandagiri',
      description: 'Dangerous road subsidence and void formation on NH-16 service road.',
      category: 'roads',
      subcategory: 'road_cavity',
      department_id: 'BMC_ROADS',
      ward_id: 'WARD-009',
      location: { lat: 20.2589, lng: 85.7876 },
      status: ProblemStatus.NEW,
      signal_count: 38,
      supporting_media_count: 9,
      estimated_population: 9400,
      duration_days: 1,
      severity_score: 21,
      population_score: 15,
      duration_score: 10,
      concentration_score: 12,
      critical_exposure_score: 9,
      recurrence_score: 9,
      evidence_score: 5,
      impact_score: 81,
      impact_level: ImpactLevel.HIGH,
      impact_explanation: 'Severe road cavity presenting vehicular accident risk along primary transit corridor.',
      confidence: 0.88,
      first_detected_at: '2026-09-06T04:00:00Z',
      last_updated_at: '2026-09-06T22:00:00Z',
      created_at: '2026-09-06T04:00:00Z',
      updated_at: '2026-09-06T22:00:00Z',
      is_demo: true
    };
    this.problemClusters.set(problem3.id, problem3);

    const problem4: ProblemCluster = {
      id: 'PRB-2026-0822',
      title: 'Garbage Transfer Station Overflow — Old Town',
      description: 'Solid waste accumulation spilling past boundary into temple heritage perimeter.',
      category: 'sanitation',
      subcategory: 'waste_overflow',
      department_id: 'BMC_SAN',
      ward_id: 'WARD-012',
      location: { lat: 20.2405, lng: 85.8342 },
      status: ProblemStatus.NEW,
      signal_count: 52,
      supporting_media_count: 11,
      estimated_population: 8200,
      duration_days: 2,
      severity_score: 18,
      population_score: 16,
      duration_score: 12,
      concentration_score: 11,
      critical_exposure_score: 7,
      recurrence_score: 8,
      evidence_score: 5,
      impact_score: 77,
      impact_level: ImpactLevel.HIGH,
      impact_explanation: 'Significant waste overflow adjacent to heritage site with community sanitation impact.',
      confidence: 0.87,
      first_detected_at: '2026-09-05T14:00:00Z',
      last_updated_at: '2026-09-06T18:00:00Z',
      created_at: '2026-09-05T14:00:00Z',
      updated_at: '2026-09-06T18:00:00Z',
      is_demo: true
    };
    this.problemClusters.set(problem4.id, problem4);
  }

  // Users & Profiles
  async getUser(id: string): Promise<UserProfile | null> {
    return this.users.get(id) || null;
  }

  async getUserByAuthId(authUserId: string): Promise<UserProfile | null> {
    for (const u of this.users.values()) {
      if ((u as any).auth_user_id === authUserId || u.id === authUserId) {
        return { ...u };
      }
    }
    return null;
  }

  async createUser(user: UserProfile): Promise<UserProfile> {
    this.users.set(user.id, user);
    return user;
  }

  async listUsers(filter?: { role?: UserRole; department_id?: string }): Promise<UserProfile[]> {
    let list = Array.from(this.users.values()).map((u) => ({ ...u }));
    if (filter?.role) {
      list = list.filter((u) => u.role === filter.role);
    }
    if (filter?.department_id) {
      list = list.filter((u) => u.department_id === filter.department_id);
    }
    return list;
  }

  async getCitizenProfile(userId: string): Promise<CitizenProfile | null> {
    return this.citizenProfiles.get(userId) || null;
  }

  async createCitizenProfile(profile: CitizenProfile): Promise<CitizenProfile> {
    this.citizenProfiles.set(profile.user_id, profile);
    return profile;
  }

  // Signals
  async createSignal(signal: Signal): Promise<Signal> {
    this.signals.set(signal.id, { ...signal });
    return signal;
  }

  async getSignal(id: string): Promise<Signal | null> {
    const s = this.signals.get(id);
    return s ? { ...s } : null;
  }

  async updateSignal(id: string, updates: Partial<Signal>): Promise<Signal> {
    const existing = this.signals.get(id);
    if (!existing) {
      throw new Error(`Signal ${id} not found for update`);
    }
    const updated: Signal = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString()
    };
    this.signals.set(id, updated);
    return { ...updated };
  }

  async listSignals(filter: SignalFilterCriteria): Promise<{ data: Signal[]; nextCursor?: string }> {
    let result = Array.from(this.signals.values());

    if (filter.citizen_id) {
      result = result.filter((s) => s.citizen_id === filter.citizen_id);
    }
    if (filter.department_id) {
      result = result.filter((s) => s.department_id === filter.department_id);
    }
    if (filter.ward_id) {
      result = result.filter((s) => s.ward_id === filter.ward_id);
    }
    if (filter.status) {
      result = result.filter((s) => s.status === filter.status);
    }
    if (filter.category) {
      result = result.filter((s) => s.category === filter.category);
    }

    // Sort newest first
    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const limit = filter.limit || 20;
    const paginated = result.slice(0, limit);

    return {
      data: paginated,
      nextCursor: result.length > limit ? paginated[paginated.length - 1]?.id : undefined
    };
  }

  // Media
  async createSignalMedia(media: SignalMediaItem): Promise<SignalMediaItem> {
    const list = this.signalMedia.get(media.signal_id) || [];
    list.push(media);
    this.signalMedia.set(media.signal_id, list);
    return media;
  }

  async getSignalMedia(signalId: string): Promise<SignalMediaItem[]> {
    return this.signalMedia.get(signalId) || [];
  }

  async getSignalMediaByPath(storagePath: string): Promise<SignalMediaItem | null> {
    for (const list of this.signalMedia.values()) {
      const found = list.find((m) => m.storage_path === storagePath);
      if (found) return found;
    }
    return null;
  }

  async attachMediaToSignal(signalId: string, mediaId: string): Promise<void> {
    const signal = this.signals.get(signalId);
    if (signal) {
      signal.media_ids = signal.media_ids || [];
      if (!signal.media_ids.includes(mediaId)) {
        signal.media_ids.push(mediaId);
        this.signals.set(signalId, signal);
      }
    }
  }

  // AI Operations
  async createAIOperation(op: AIOperationRecord): Promise<AIOperationRecord> {
    const list = this.aiOperations.get(op.entity_id) || [];
    list.push(op);
    this.aiOperations.set(op.entity_id, list);
    return { ...op };
  }

  async getAIOperations(entityId: string): Promise<AIOperationRecord[]> {
    const list = this.aiOperations.get(entityId) || [];
    return [...list];
  }

  // Problem Clusters
  async createProblemCluster(problem: ProblemCluster): Promise<ProblemCluster> {
    this.problemClusters.set(problem.id, { ...problem });
    return { ...problem };
  }

  async getProblemCluster(id: string): Promise<ProblemCluster | null> {
    const problem = this.problemClusters.get(id);
    return problem ? { ...problem } : null;
  }

  async updateProblemCluster(id: string, updates: Partial<ProblemCluster>): Promise<ProblemCluster> {
    const existing = this.problemClusters.get(id);
    if (!existing) {
      throw new Error(`ProblemCluster ${id} not found for update`);
    }
    const updated: ProblemCluster = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString()
    };
    this.problemClusters.set(id, updated);
    return { ...updated };
  }

  async listProblemClusters(filter: ProblemFilterCriteria): Promise<{ data: ProblemCluster[]; nextCursor?: string }> {
    let result = Array.from(this.problemClusters.values());

    if (filter.status) {
      result = result.filter((p) => p.status === filter.status);
    }
    if (filter.impact_level) {
      result = result.filter((p) => p.impact_level === filter.impact_level);
    }
    if (filter.category) {
      result = result.filter((p) => p.category === filter.category);
    }
    if (filter.department_id) {
      result = result.filter((p) => p.department_id === filter.department_id);
    }
    if (filter.ward_id) {
      result = result.filter((p) => p.ward_id === filter.ward_id);
    }
    if (filter.min_impact !== undefined) {
      result = result.filter((p) => p.impact_score >= filter.min_impact!);
    }
    if (filter.max_impact !== undefined) {
      result = result.filter((p) => p.impact_score <= filter.max_impact!);
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(
        (p) => p.title.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q))
      );
    }

    // Default sort: impact_score DESC, updated_at DESC
    if (filter.sort === 'impact_asc') {
      result.sort((a, b) => a.impact_score - b.impact_score);
    } else if (filter.sort === 'updated_desc') {
      result.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    } else if (filter.sort === 'created_desc') {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      // Default: impact_score DESC, then updated_at DESC
      result.sort((a, b) => {
        if (b.impact_score !== a.impact_score) {
          return b.impact_score - a.impact_score;
        }
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
    }

    const limit = filter.limit || 20;
    const paginated = result.slice(0, limit);

    return {
      data: paginated,
      nextCursor: result.length > limit ? paginated[paginated.length - 1]?.id : undefined
    };
  }

  // Cluster Members
  async addProblemClusterMember(member: ProblemClusterMember): Promise<ProblemClusterMember> {
    const list = this.problemClusterMembers.get(member.problem_id) || [];
    list.push(member);
    this.problemClusterMembers.set(member.problem_id, list);
    return { ...member };
  }

  async getProblemClusterMembers(problemId: string): Promise<ProblemClusterMember[]> {
    const list = this.problemClusterMembers.get(problemId) || [];
    return list.map((m) => {
      const sig = this.signals.get(m.signal_id);
      return {
        ...m,
        signal: sig ? { ...sig } : undefined
      };
    });
  }

  async getSignalClusterMemberships(signalId: string): Promise<ProblemClusterMember[]> {
    const results: ProblemClusterMember[] = [];
    for (const members of this.problemClusterMembers.values()) {
      for (const m of members) {
        if (m.signal_id === signalId) {
          results.push({ ...m });
        }
      }
    }
    return results;
  }

  // Workflow, Assignments & Actions
  async createAssignment(assignment: Assignment): Promise<Assignment> {
    const list = this.assignments.get(assignment.problem_id) || [];
    list.push({ ...assignment });
    this.assignments.set(assignment.problem_id, list);
    return { ...assignment };
  }

  async getAssignments(problemId: string): Promise<Assignment[]> {
    const list = this.assignments.get(problemId) || [];
    return list.map((a) => ({ ...a }));
  }

  async listAssignments(filter: { department_id?: string; assigned_to?: string; status?: string }): Promise<Assignment[]> {
    const results: Assignment[] = [];
    for (const list of this.assignments.values()) {
      for (const a of list) {
        if (filter.department_id && a.department_id !== filter.department_id) continue;
        if (filter.assigned_to && a.assigned_to !== filter.assigned_to) continue;
        if (filter.status && a.status !== filter.status) continue;
        results.push({ ...a });
      }
    }
    return results;
  }

  async createAction(action: ProblemAction): Promise<ProblemAction> {
    const list = this.actions.get(action.problem_id) || [];
    list.push({ ...action });
    this.actions.set(action.problem_id, list);
    return { ...action };
  }

  async getActions(problemId: string): Promise<ProblemAction[]> {
    const list = this.actions.get(problemId) || [];
    return list
      .map((a) => ({ ...a }))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  // Departments & Workload
  async listDepartments(): Promise<Department[]> {
    return Array.from(this.departments.values()).map((d) => ({ ...d }));
  }

  async getDepartment(id: string): Promise<Department | null> {
    const d = this.departments.get(id);
    return d ? { ...d } : null;
  }

  async createDepartment(department: Department): Promise<Department> {
    this.departments.set(department.id, { ...department });
    return { ...department };
  }

  async getDepartmentWorkload(id: string): Promise<DepartmentWorkload> {
    const dept = this.departments.get(id);
    if (!dept) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `Department ${id} not found.`
      });
    }

    let totalAssigned = 0;
    let activeInProgress = 0;
    let awaitingVerification = 0;
    let criticalOrHigh = 0;
    let slaBreached = 0;
    let slaAtRisk = 0;

    for (const p of this.problemClusters.values()) {
      if (p.department_id === id) {
        totalAssigned++;
        if (p.status === ProblemStatus.IN_PROGRESS) activeInProgress++;
        if (p.status === ProblemStatus.AWAITING_VERIFICATION) awaitingVerification++;
        if (p.impact_level === ImpactLevel.CRITICAL || p.impact_level === ImpactLevel.HIGH) {
          criticalOrHigh++;
        }
        if (p.sla_state?.is_breached || p.sla_state?.status === 'BREACHED') {
          slaBreached++;
        } else if (p.sla_state?.is_at_risk || p.sla_state?.status === 'AT_RISK') {
          slaAtRisk++;
        }
      }
    }

    return {
      department_id: id,
      department_name: dept.name,
      total_assigned: totalAssigned,
      active_in_progress: activeInProgress,
      awaiting_verification: awaitingVerification,
      critical_or_high: criticalOrHigh,
      sla_breached: slaBreached,
      sla_at_risk: slaAtRisk,
      capacity_rating: activeInProgress > 10 ? 'CONGESTED' : activeInProgress > 5 ? 'MODERATE' : 'OPTIMAL'
    };
  }

  async listDepartmentOfficers(departmentId: string): Promise<UserProfile[]> {
    return Array.from(this.users.values()).filter(
      (u) => u.department_id === departmentId && (u.role === UserRole.FIELD_OFFICER || u.role === UserRole.DEPARTMENT_OFFICER)
    );
  }

  // Atomic Workflow Mutations (Concurrency & State Integrity)
  async atomicAssignProblem(
    problemId: string,
    assignment: Assignment,
    nextStatus: ProblemStatus,
    action: ProblemAction,
    expectedCurrentStatus?: ProblemStatus
  ): Promise<{ problem: ProblemCluster; assignment: Assignment; action: ProblemAction }> {
    const existing = this.problemClusters.get(problemId);
    if (!existing) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `ProblemCluster ${problemId} not found.`
      });
    }

    if (expectedCurrentStatus && existing.status !== expectedCurrentStatus) {
      throw new AppError({
        statusCode: 400,
        code: ERROR_CODES.INVALID_STATE_TRANSITION,
        message: `Assignment state transition conflict: expected current state is ${expectedCurrentStatus}, but persisted state is ${existing.status}.`
      });
    }

    const now = new Date().toISOString();
    const updatedProblem: ProblemCluster = {
      ...existing,
      department_id: assignment.department_id,
      assigned_to: assignment.assigned_to,
      assigned_at: assignment.assigned_at || now,
      status: nextStatus,
      updated_at: now
    };

    this.problemClusters.set(problemId, updatedProblem);
    const createdAssignment = await this.createAssignment(assignment);
    const createdAction = await this.createAction(action);

    return { problem: updatedProblem, assignment: createdAssignment, action: createdAction };
  }

  async atomicCreateClusterFromSignal(
    problem: ProblemCluster,
    member: ProblemClusterMember,
    signalId: string
  ): Promise<{ problem: ProblemCluster; member: ProblemClusterMember }> {
    const signal = this.signals.get(signalId);
    if (!signal) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `Signal ${signalId} not found during cluster creation.`
      });
    }

    const now = new Date().toISOString();
    const updatedSignal: Signal = {
      ...signal,
      status: SignalStatus.ATTACHED_TO_PROBLEM,
      problem_cluster_id: problem.id,
      updated_at: now
    };

    this.problemClusters.set(problem.id, problem);
    this.problemClusterMembers.set(problem.id, [member]);
    this.signals.set(signalId, updatedSignal);

    return { problem, member };
  }

  async atomicReviewResolution(
    problemId: string,
    decision: 'ACCEPT' | 'REJECT',
    action: ProblemAction,
    evidenceIds: string[],
    notes?: string
  ): Promise<{ problem: ProblemCluster; action: ProblemAction; decision: string }> {
    const existing = this.problemClusters.get(problemId);
    if (!existing) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `ProblemCluster ${problemId} not found.`
      });
    }

    if (existing.status !== ProblemStatus.AWAITING_VERIFICATION) {
      throw new AppError({
        statusCode: 400,
        code: ERROR_CODES.INVALID_STATE_TRANSITION,
        message: `State transition conflict: expected AWAITING_VERIFICATION, but problem is currently in ${existing.status}.`
      });
    }

    const now = new Date().toISOString();
    const nextStatus = decision === 'ACCEPT' ? ProblemStatus.RESOLVED : ProblemStatus.IN_PROGRESS;
    const evidenceTargetStatus = decision === 'ACCEPT' ? EvidenceStatus.ACCEPTED : EvidenceStatus.REJECTED;

    const updatedProblem: ProblemCluster = {
      ...existing,
      status: nextStatus,
      updated_at: now,
      ...(decision === 'ACCEPT' ? { resolved_at: now } : {})
    };

    // Update evidence in-memory
    const existingEvidenceList = this.resolutionEvidence.get(problemId) || [];
    for (const ev of existingEvidenceList) {
      if (evidenceIds.includes(ev.id)) {
        ev.status = evidenceTargetStatus;
        ev.updated_at = now;
      }
    }

    this.problemClusters.set(problemId, updatedProblem);
    const createdAction = await this.createAction(action);

    return { problem: updatedProblem, action: createdAction, decision };
  }

  async atomicTransitionStatus(
    problemId: string,
    expectedCurrentStatus: ProblemStatus,
    nextStatus: ProblemStatus,
    action: ProblemAction,
    updates?: Partial<ProblemCluster>
  ): Promise<{ problem: ProblemCluster; action: ProblemAction }> {
    const existing = this.problemClusters.get(problemId);
    if (!existing) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `ProblemCluster ${problemId} not found.`
      });
    }

    // Atomic pre-mutation check: Prevent stale concurrent transitions
    if (existing.status !== expectedCurrentStatus) {
      throw new AppError({
        statusCode: 400,
        code: ERROR_CODES.INVALID_STATE_TRANSITION,
        message: `State transition conflict: expected current state is ${expectedCurrentStatus}, but persisted state is ${existing.status}.`
      });
    }

    const now = new Date().toISOString();
    const updatedProblem: ProblemCluster = {
      ...existing,
      ...updates,
      status: nextStatus,
      updated_at: now
    };

    if (nextStatus === ProblemStatus.RESOLVED && !updatedProblem.resolved_at) {
      updatedProblem.resolved_at = now;
    }
    if (nextStatus === ProblemStatus.CLOSED && !updatedProblem.closed_at) {
      updatedProblem.closed_at = now;
    }

    this.problemClusters.set(problemId, updatedProblem);
    const createdAction = await this.createAction(action);

    return { problem: updatedProblem, action: createdAction };
  }

  // Resolution Evidence & Verification (Phase 6)
  async createResolutionEvidence(evidence: ResolutionEvidence): Promise<ResolutionEvidence> {
    const list = this.resolutionEvidence.get(evidence.problem_id) || [];
    // Ensure immutable audit: always append, never overwrite prior evidence
    list.push(evidence);
    this.resolutionEvidence.set(evidence.problem_id, list);
    return evidence;
  }

  async getResolutionEvidence(problemId: string): Promise<ResolutionEvidence[]> {
    return this.resolutionEvidence.get(problemId) || [];
  }

  async getResolutionEvidenceByPath(storagePath: string): Promise<ResolutionEvidence | null> {
    for (const list of this.resolutionEvidence.values()) {
      const found = list.find((e) => e.storage_path === storagePath);
      if (found) return found;
    }
    return null;
  }

  async getEvidenceById(id: string): Promise<ResolutionEvidence | null> {
    for (const list of this.resolutionEvidence.values()) {
      const found = list.find((e) => e.id === id);
      if (found) return found;
    }
    return null;
  }

  async updateResolutionEvidence(id: string, updates: Partial<ResolutionEvidence>): Promise<ResolutionEvidence> {
    for (const [probId, list] of this.resolutionEvidence.entries()) {
      const idx = list.findIndex((e) => e.id === id);
      if (idx !== -1) {
        const updated: ResolutionEvidence = {
          ...list[idx]!,
          ...updates,
          updated_at: new Date().toISOString()
        };
        list[idx] = updated;
        this.resolutionEvidence.set(probId, list);
        return updated;
      }
    }
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
      message: `ResolutionEvidence ${id} not found.`
    });
  }

  async createVerificationResult(result: VerificationResult): Promise<VerificationResult> {
    const list = this.verificationResults.get(result.problem_id) || [];
    list.push(result);
    this.verificationResults.set(result.problem_id, list);
    return result;
  }

  async getVerificationHistory(problemId: string): Promise<VerificationResult[]> {
    return this.verificationResults.get(problemId) || [];
  }

  async getLatestVerification(evidenceId: string): Promise<VerificationResult | null> {
    for (const list of this.verificationResults.values()) {
      const matches = list.filter((v) => v.evidence_id === evidenceId);
      if (matches.length > 0) {
        return matches[matches.length - 1]!;
      }
    }
    return null;
  }

  async checkReadiness(): Promise<{ ready: boolean; latencyMs: number }> {
    return { ready: true, latencyMs: 1 };
  }

  /**
   * DEMO-ONLY: Deterministically restores the in-memory database to its canonical Golden Demo state.
   * Completely clears all mutated collections and re-seeds canonical fixtures:
   * - ProblemCluster PRB-2026-0819 (Score 92, Nayapalli Ward 18, WATCO)
   * - Canonical signals, members, assignment, actions, and resolution evidence
   * - Municipal departments and demo personas
   */
  public resetToGoldenDemo(): void {
    this.users.clear();
    this.citizenProfiles.clear();
    this.signals.clear();
    this.signalMedia.clear();
    this.aiOperations.clear();
    this.problemClusters.clear();
    this.problemClusterMembers.clear();
    this.assignments.clear();
    this.actions.clear();
    this.departments.clear();
    this.resolutionEvidence.clear();
    this.verificationResults.clear();
    this.seedMinimalFixtures();
  }
}

