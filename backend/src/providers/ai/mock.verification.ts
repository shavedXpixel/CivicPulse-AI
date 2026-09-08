import {
  IAIVerificationProvider,
  VerifyResolutionInput,
  VerificationAnalysisOutput
} from './verification.interface';
import { VerificationResultStatus } from '@civicpulse/shared';
import { PROMPT_VERSION_RESOLUTION_VERIFICATION } from '../../infrastructure/ai/prompts/resolution_verification_v1';

export class MockVerificationProvider implements IAIVerificationProvider {
  private _simulateFailure = false;
  private _simulateMalformed = false;
  private _simulateInconclusive = false;
  private _simulateRejected = false;
  private _simulateTimeout = false;

  public simulateFailure(val: boolean = true) {
    this._simulateFailure = val;
  }

  public simulateMalformed(val: boolean = true) {
    this._simulateMalformed = val;
  }

  public simulateInconclusive(val: boolean = true) {
    this._simulateInconclusive = val;
  }

  public simulateRejected(val: boolean = true) {
    this._simulateRejected = val;
  }

  public simulateTimeout(val: boolean = true) {
    this._simulateTimeout = val;
  }

  public getModelName(): string {
    return 'mock-verification-v1';
  }

  public getPromptVersion(): string {
    return PROMPT_VERSION_RESOLUTION_VERIFICATION;
  }

  async verifyResolutionEvidence(input: VerifyResolutionInput): Promise<VerificationAnalysisOutput> {
    if (this._simulateTimeout) {
      await new Promise((resolve) => setTimeout(resolve, 15000));
    }

    if (this._simulateFailure) {
      throw new Error('Simulated Mock AI verification provider failure for resilience testing');
    }

    if (this._simulateMalformed) {
      // Returns an invalid schema object to test graceful schema rejection fallback
      return {
        invalid_structure: true
      } as any;
    }

    // Force simulation flags for deterministic test suites
    if (this._simulateInconclusive) {
      return {
        verification_result: VerificationResultStatus.INCONCLUSIVE,
        confidence: 0.54,
        observed_conditions: ['Partial surface work visible; obstructed camera angle.'],
        evidence_summary: 'Submitted evidence is ambiguous and does not conclusively verify completed infrastructure restoration.',
        before_after_comparison: {
          improved: false,
          summary: 'Before and after photographs show differing perspective; repair site cannot be uniquely correlated.',
          changes_observed: ['Excavation mound visible but joint status unverified.'],
          limitations: ['Image captured at night with insufficient illumination.']
        },
        inconsistencies: ['Mismatched perspective with original grievance photo.'],
        explanation: 'Evidence confidence falls below the 0.65 threshold. Case remains awaiting verification pending human review.',
        recommended_review_reason: 'Request on-site physical re-inspection from supervisory officer.',
        limitations: ['Single photograph without pressure telemetry log.'],
        review_required: true
      };
    }

    if (this._simulateRejected) {
      return {
        verification_result: VerificationResultStatus.REJECTED,
        confidence: 0.91,
        observed_conditions: ['Active pooling water and unbolted pipe flange visible in completion photo.'],
        evidence_summary: 'Submitted evidence directly contradicts the claim of completed repair.',
        before_after_comparison: {
          improved: false,
          summary: 'Road surface remains submerged; failure mode appears ongoing.',
          changes_observed: ['No material remediation observed.'],
          limitations: ['Photograph taken during active disruption.']
        },
        inconsistencies: ['Active leakage visible despite field note claiming restoration.'],
        explanation: 'Contradictory visual evidence indicates that reported disruption is still active.',
        recommended_review_reason: 'Supervisor must reject resolution and instruct officer to resume physical remediation.',
        limitations: ['Photographic evidence definitively shows unresolved defect.'],
        review_required: true
      };
    }

    const note = (input.evidence.description || '').toLowerCase();

    // Golden Demo Scenario: PRB-2026-0819
    if (input.problem_id === 'PRB-2026-0819') {
      return {
        verification_result: VerificationResultStatus.VERIFIED,
        confidence: 0.93,
        observed_conditions: [
          'High-pressure 250mm DI flange pipe joint securely replaced and bolted to engineering spec',
          'Hydrostatic test gauge reading stable 3.8 bar distribution pressure',
          'Excavation trench backfilled, compacted, and roadway surface cleared of standing water'
        ],
        evidence_summary: 'Post-repair photographic evidence and WATCO engineering log confirm physical replacement of ruptured water main section on Nayapalli corridor.',
        before_after_comparison: {
          improved: true,
          summary: 'Severe road flooding and ruptured pipe visible in original signal is eliminated; dry roadway and restored pipeline integrity verified.',
          changes_observed: [
            'Flooding depth decreased from 15cm to zero standing water',
            'Cracked legacy cast-iron section replaced with new ductile iron flanged assembly',
            'Substation access corridor reopened to vehicular traffic'
          ],
          limitations: [
            'Photographic evidence confirms external joint assembly and dry pavement, but cannot test long-term subterranean pipe durability.'
          ]
        },
        inconsistencies: [],
        explanation: 'Submitted evidence demonstrates strong visual, operational, and telemetry consistency with complete water supply remediation. Advisory verification confirmed.',
        recommended_review_reason: null,
        limitations: [
          'Visual inspection is advisory and cannot establish underground water quality or long-term distribution flow beyond the junction.',
          'Official resolution requires authorized departmental supervisor sign-off.'
        ],
        review_required: true
      };
    }

    // Contradictory evidence detection
    if (
      note.includes('still leaking') ||
      note.includes('not repaired') ||
      note.includes('failed pressure') ||
      note.includes('overflow continuing') ||
      note.includes('wrong location')
    ) {
      return {
        verification_result: VerificationResultStatus.REJECTED,
        confidence: 0.88,
        observed_conditions: ['Field note indicates failed repair or ongoing leakage.'],
        evidence_summary: 'Resolution evidence indicates unresolved conditions or failed pressure test.',
        inconsistencies: ['Field report indicates failure of repair protocol.'],
        explanation: 'Evidence directly contradicts remediation. Problem remains in AWAITING_VERIFICATION for human supervisory action.',
        recommended_review_reason: 'Officer reported ongoing failure. Case requires re-dispatch.',
        limitations: ['Derived from officer field log telemetry.'],
        review_required: true
      };
    }

    // Low confidence / insufficient note detection
    if (note.length < 10) {
      return {
        verification_result: VerificationResultStatus.INCONCLUSIVE,
        confidence: 0.52,
        observed_conditions: ['Minimal documentation submitted.'],
        evidence_summary: 'Insufficient field notes or telemetry provided to establish conclusive verification.',
        inconsistencies: ['Lack of detailed engineering completion notes.'],
        explanation: 'Confidence is below the 0.65 threshold. Human review is required to validate proof.',
        recommended_review_reason: 'Insufficient proof submitted; require detailed completion notes.',
        limitations: ['Minimal metadata provided.'],
        review_required: true
      };
    }

    // Default positive verification for valid proof
    return {
      verification_result: VerificationResultStatus.VERIFIED,
      confidence: 0.87,
      observed_conditions: [
        'Infrastructure repairs appear physically completed in accordance with municipal standards',
        'Site restored to operational status'
      ],
      evidence_summary: 'Submitted resolution evidence appears consistent with reported civic remediation.',
      before_after_comparison: {
        improved: true,
        summary: 'Reported civic defect appears resolved based on submitted field evidence.',
        changes_observed: ['Surface defect no longer observable at site'],
        limitations: ['Image evidence cannot verify long-term subterranean structural longevity.']
      },
      inconsistencies: [],
      explanation: 'Submitted proof satisfies advisory verification criteria.',
      recommended_review_reason: null,
      limitations: [
        'Photographic evidence is advisory only.',
        'Human supervisor review required for official resolution.'
      ],
      review_required: true
    };
  }
}
