/**
 * CivicPulse Development Demand Intelligence — PII Sanitizer
 * 
 * Deterministically strips citizen personal identifiers (phone, email, self-identification
 * personal names, residential house/plot numbers) prior to transmitting text to AI providers.
 * Coarse civic geography (e.g., "Ward 19", "GGP Colony", "Unit 3 Market") is preserved.
 */

export interface DemandSanitizationResult {
  sanitizedText: string;
  hasRedactions: boolean;
  redactedTypes: ('PHONE' | 'EMAIL' | 'PERSONAL_NAME' | 'RESIDENTIAL_IDENTIFIER' | 'SYSTEM_ID' | 'EXACT_COORDINATES')[];
}

const PHONE_REGEX = /(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b|\b0\d{2,4}[\s-]?\d{6,8}\b|\b[6-9]\d{9}\b/g;

const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

// User IDs, Auth IDs, submitter UUIDs, officer UUIDs
const AUTH_OR_SYSTEM_ID_REGEX = /\b(?:usr_|off_|auth_|uid_|user_)[a-zA-Z0-9_-]+\b|\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

// Exact household coordinates (e.g. 20.2551234, 85.7821234)
const EXACT_COORDINATES_REGEX = /\b-?\d{1,3}\.\d{4,},\s*-?\d{1,3}\.\d{4,}\b/g;

// Self-identification name patterns (English, Odia, Hindi)
const ENGLISH_NAME_INTRO_REGEX = /\b(?:my name is|i am|myself|this is|shri|smt|mr\.|mrs\.|dr\.)\s+([A-Za-z]+(?:\s+[A-Za-z]+){0,2})\b/gi;
const ODIA_NAME_INTRO_REGEX = /(?:ମୋ ନାମ|ମୋ ନାଁ|ମୁଁ)\s+([A-Za-z\u0B00-\u0B7F]+(?:\s+[A-Za-z\u0B00-\u0B7F]+){0,2})/gi;
const HINDI_NAME_INTRO_REGEX = /(?:मेरा नाम|मैं)\s+([A-Za-z\u0900-\u097F]+(?:\s+[A-Za-z\u0900-\u097F]+){0,2})/gi;

// Residential parcel identifiers (House/Plot/Flat/Quarter numbers)
const RESIDENTIAL_IDENTIFIER_REGEX = /\b(?:plot|flat|house|qtr|quarter|holding|door|room)\s*(?:no\.?|number|#)?\s*[:#-]?\s*[a-zA-Z0-9/-]+\b/gi;

export function sanitizeDemandPII(rawText: string): DemandSanitizationResult {
  if (!rawText || typeof rawText !== 'string') {
    return {
      sanitizedText: '',
      hasRedactions: false,
      redactedTypes: []
    };
  }

  let text = rawText;
  const redactedTypes: ('PHONE' | 'EMAIL' | 'PERSONAL_NAME' | 'RESIDENTIAL_IDENTIFIER' | 'SYSTEM_ID' | 'EXACT_COORDINATES')[] = [];

  // 1. Redact Email addresses
  if (EMAIL_REGEX.test(text)) {
    text = text.replace(EMAIL_REGEX, '[REDACTED_EMAIL]');
    redactedTypes.push('EMAIL');
  }

  // 2. Redact Phone numbers
  if (PHONE_REGEX.test(text)) {
    text = text.replace(PHONE_REGEX, '[REDACTED_PHONE]');
    redactedTypes.push('PHONE');
  }

  // 3. Redact Residential identifiers
  if (RESIDENTIAL_IDENTIFIER_REGEX.test(text)) {
    text = text.replace(RESIDENTIAL_IDENTIFIER_REGEX, '[REDACTED_RESIDENCE]');
    redactedTypes.push('RESIDENTIAL_IDENTIFIER');
  }

  // 4. Redact Self-identification personal names
  let nameRedacted = false;
  if (ENGLISH_NAME_INTRO_REGEX.test(text)) {
    text = text.replace(ENGLISH_NAME_INTRO_REGEX, (match, p1) => {
      nameRedacted = true;
      const prefix = match.slice(0, match.indexOf(p1));
      return `${prefix}[REDACTED_NAME]`;
    });
  }

  if (ODIA_NAME_INTRO_REGEX.test(text)) {
    text = text.replace(ODIA_NAME_INTRO_REGEX, (match, p1) => {
      nameRedacted = true;
      const prefix = match.slice(0, match.indexOf(p1));
      return `${prefix}[REDACTED_NAME]`;
    });
  }

  if (HINDI_NAME_INTRO_REGEX.test(text)) {
    text = text.replace(HINDI_NAME_INTRO_REGEX, (match, p1) => {
      nameRedacted = true;
      const prefix = match.slice(0, match.indexOf(p1));
      return `${prefix}[REDACTED_NAME]`;
    });
  }

  if (nameRedacted && !redactedTypes.includes('PERSONAL_NAME')) {
    redactedTypes.push('PERSONAL_NAME');
  }

  // 5. Redact System IDs, Auth User IDs, and Officer UUIDs
  if (AUTH_OR_SYSTEM_ID_REGEX.test(text)) {
    text = text.replace(AUTH_OR_SYSTEM_ID_REGEX, '[REDACTED_ID]');
    redactedTypes.push('SYSTEM_ID');
  }

  // 6. Redact Exact Coordinates (GPS Lat/Lng with 4+ decimal places)
  if (EXACT_COORDINATES_REGEX.test(text)) {
    text = text.replace(EXACT_COORDINATES_REGEX, '[REDACTED_COORDINATES]');
    redactedTypes.push('EXACT_COORDINATES');
  }

  return {
    sanitizedText: text,
    hasRedactions: redactedTypes.length > 0,
    redactedTypes
  };
}
