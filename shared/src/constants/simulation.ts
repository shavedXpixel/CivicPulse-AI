export const SIMULATION_CONSTANTS = {
  // Input Constraints & Bounds
  MIN_EXTRA_CREWS: 0,
  MAX_EXTRA_CREWS: 5,
  MIN_RESPONSE_REDUCTION_HOURS: 0,
  MAX_RESPONSE_REDUCTION_HOURS: 24,
  MIN_PHYSICAL_MTTR_HOURS: 4, // Physical lower bound on pipe excavation & welding

  // Population Relief Bounds
  MAX_POPULATION_RELIEF_RATE: 1.0,
  CREW_POPULATION_BOOST_PER_TEAM: 0.05, // Each extra distribution team adds 5% relief coverage
  MAX_CREW_POPULATION_BOOST: 0.20,

  // Duration & Repair Compression
  CREW_SPEEDUP_FACTOR: 0.50, // repair_time = baseline_remaining / (1 + 0.50 * extra_crews)

  // SLA Utilization Bands
  SLA_UTILIZATION_LOW_MAX: 0.75,     // <= 75% SLA used -> LOW risk (Within SLA)
  SLA_UTILIZATION_MEDIUM_MAX: 1.00,  // 75% - 100% SLA used -> MEDIUM risk (Near Deadline)
  SLA_UTILIZATION_HIGH_MAX: 1.50,    // 100% - 150% SLA used -> HIGH risk (BREACHED)
                                     // > 150% SLA used -> CRITICAL risk (SEVERE BREACH)

  // Default Simulation Assumptions (clearly labeled as assumptions, not DB facts)
  DEFAULT_ASSUMED_REMAINING_HOURS: 24,
  DEFAULT_CONTINGENCY_BUFFER_RATE: 0.08, // 8% unallocated buffer for budget simulations
  DEFAULT_RECURRENCE_HORIZON_DAYS: 90    // Standard modeled horizon for recurrence assumptions
} as const;

export enum SlaRiskBand {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum SlaStatus {
  WITHIN_SLA = 'WITHIN_SLA',
  NEAR_BREACH = 'NEAR_BREACH',
  BREACHED = 'BREACHED'
}
