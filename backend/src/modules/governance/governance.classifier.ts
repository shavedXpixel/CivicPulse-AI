import { GovernanceQueryIntent } from '@civicpulse/shared';

export interface ClassifiedQueryPlan {
  intent: GovernanceQueryIntent;
  tools: string[];
  extracted_entities: {
    problem_id?: string;
    ward_id?: string;
    department_id?: string;
    category?: string;
  };
}

export class GovernanceClassifier {
  /**
   * Deterministically classifies natural language questions into allowlisted intents.
   * Model cannot invent arbitrary tool calls.
   */
  public static classify(question: string, context?: { ward_id?: string; department_id?: string }): ClassifiedQueryPlan {
    const q = question.toLowerCase().trim();

    // 1. Entity Extraction
    const extracted_entities: ClassifiedQueryPlan['extracted_entities'] = {
      ward_id: context?.ward_id,
      department_id: context?.department_id
    };

    // Check for explicit problem ID like PRB-2026-0819 or 0819
    const prbMatch = question.match(/PRB-\d{4}-\d{4}/i);
    if (prbMatch) {
      extracted_entities.problem_id = prbMatch[0].toUpperCase();
    } else if (q.includes('water problem') || q.includes('nayapalli') || q.includes('819')) {
      extracted_entities.problem_id = 'PRB-2026-0819';
    }

    // Check for Ward
    if (q.includes('ward 18') || q.includes('ward-18') || q.includes('ward-018')) {
      extracted_entities.ward_id = 'WARD-018';
    } else if (q.includes('ward 4') || q.includes('ward 04')) {
      extracted_entities.ward_id = 'WARD-004';
    }

    // Check for Department
    if (q.includes('watco') || q.includes('water')) {
      extracted_entities.department_id = 'WATCO';
      extracted_entities.category = 'water_supply';
    } else if (q.includes('drainage') || q.includes('bmc drainage')) {
      extracted_entities.department_id = 'BMC_DRAINAGE';
      extracted_entities.category = 'drainage';
    } else if (q.includes('road')) {
      extracted_entities.department_id = 'BMC_ROADS';
      extracted_entities.category = 'roads';
    } else if (q.includes('sanitation') || q.includes('waste')) {
      extracted_entities.department_id = 'BMC_SAN';
      extracted_entities.category = 'sanitation';
    }

    // 2. Out of domain / unsupported detection
    // If the question is about completely unrelated subjects (weather, sports, cooking, stock trading, poetry)
    const unrelatedKeywords = ['weather', 'recipe', 'cook', 'cricket', 'football', 'bitcoin', 'stock market', 'movie', 'song', 'poem'];
    if (unrelatedKeywords.some((k) => q.includes(k))) {
      return {
        intent: GovernanceQueryIntent.UNSUPPORTED,
        tools: [],
        extracted_entities
      };
    }

    // 3. WHY_RANKED Intent
    if (
      (q.includes('why') && (q.includes('rank') || q.includes('score') || q.includes('highest') || q.includes('above') || q.includes('water'))) ||
      q.includes('why is the water problem') ||
      q.includes('why is prb') ||
      q.includes('factor breakdown')
    ) {
      return {
        intent: GovernanceQueryIntent.WHY_RANKED,
        tools: ['getTopProblems', 'getProblemDetails'],
        extracted_entities: {
          ...extracted_entities,
          problem_id: extracted_entities.problem_id || 'PRB-2026-0819'
        }
      };
    }

    // 4. RESOLUTION_PERFORMANCE Intent
    if (
      q.includes('resolution') ||
      q.includes('evidence') ||
      q.includes('proof') ||
      q.includes('repair proof') ||
      q.includes('photo') ||
      q.includes('verification') ||
      q.includes('what evidence supports')
    ) {
      return {
        intent: GovernanceQueryIntent.RESOLUTION_PERFORMANCE,
        tools: ['getResolutionPerformance', 'getProblemDetails'],
        extracted_entities: {
          ...extracted_entities,
          problem_id: extracted_entities.problem_id || 'PRB-2026-0819'
        }
      };
    }

    // 5. SLA_RISK Intent
    if (
      q.includes('sla') ||
      q.includes('breach') ||
      q.includes('highest risk') ||
      q.includes('compliance') ||
      q.includes('overdue') ||
      q.includes('deadline') ||
      q.includes('backlog')
    ) {
      return {
        intent: GovernanceQueryIntent.SLA_RISK,
        tools: ['getSlaRisk', 'getDepartmentBacklog'],
        extracted_entities
      };
    }

    // 6. PROBLEM_DETAILS / Current Status Intent
    if (
      (q.includes('status') && (q.includes('problem') || q.includes('water') || q.includes('prb') || q.includes('current'))) ||
      q.includes('who is assigned') ||
      q.includes('what is the current status')
    ) {
      return {
        intent: GovernanceQueryIntent.PROBLEM_DETAILS,
        tools: ['getProblemDetails', 'getProblemTimeline'],
        extracted_entities: {
          ...extracted_entities,
          problem_id: extracted_entities.problem_id || 'PRB-2026-0819'
        }
      };
    }

    // 7. FACILITY_IMPACT Intent
    if (
      q.includes('school') ||
      q.includes('hospital') ||
      q.includes('clinic') ||
      q.includes('substation') ||
      q.includes('facility') ||
      q.includes('dav')
    ) {
      return {
        intent: GovernanceQueryIntent.FACILITY_IMPACT,
        tools: ['getProblemsNearFacility', 'getTopProblems'],
        extracted_entities
      };
    }

    // 8. TREND_ANALYSIS Intent
    if (
      q.includes('trend') ||
      q.includes('increase') ||
      q.includes('decrease') ||
      q.includes('this week') ||
      q.includes('last month') ||
      q.includes('growing')
    ) {
      return {
        intent: GovernanceQueryIntent.TREND_ANALYSIS,
        tools: ['getTrend', 'getTopProblems'],
        extracted_entities
      };
    }

    // 9. WARD_IMPACT Intent
    if (
      (q.includes('ward') && (q.includes('unresolved') || q.includes('impact') || q.includes('which ward'))) ||
      q.includes('highest unresolved impact') ||
      q.includes('ward comparison')
    ) {
      return {
        intent: GovernanceQueryIntent.WARD_IMPACT,
        tools: ['getWardImpact', 'getTopProblems'],
        extracted_entities
      };
    }

    // 10. DEPARTMENT_PERFORMANCE Intent
    if (
      q.includes('department performance') ||
      q.includes('department workload') ||
      q.includes('how is watco performing')
    ) {
      return {
        intent: GovernanceQueryIntent.DEPARTMENT_PERFORMANCE,
        tools: ['getDepartmentPerformance', 'getDepartmentBacklog'],
        extracted_entities
      };
    }

    // 11. TOP_PROBLEMS Intent (Default high-priority ranking query)
    if (
      q.includes('top') ||
      q.includes('urgent') ||
      q.includes('priority') ||
      q.includes('highest') ||
      q.includes('critical') ||
      q.includes('problems in ward 18')
    ) {
      return {
        intent: GovernanceQueryIntent.TOP_PROBLEMS,
        tools: ['getTopProblems', 'getWardImpact'],
        extracted_entities
      };
    }

    // 12. GENERAL_GOVERNANCE_SUMMARY (Fallback for general municipal queries)
    return {
      intent: GovernanceQueryIntent.GENERAL_GOVERNANCE_SUMMARY,
      tools: ['getTopProblems', 'getDepartmentBacklog'],
      extracted_entities
    };
  }
}
