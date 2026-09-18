import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sihttdjkubjuizwdjmrj.supabase.co').replace(/\/$/, '');
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const DATABASE_URL = process.env.DATABASE_URL || '';

interface TargetAccount {
  legacy_firebase_uid: string;
  email: string;
  role: string;
  department_id: string | null;
}

const PRODUCTION_ACCOUNTS: TargetAccount[] = [
  {
    legacy_firebase_uid: 'fb_uid_admin_synthetic_01',
    email: 'admin@example.com',
    role: 'ADMIN',
    department_id: null
  },
  {
    legacy_firebase_uid: 'fb_uid_officer_synthetic_02',
    email: 'officer@example.com',
    role: 'DEPARTMENT_OFFICER',
    department_id: 'WATCO'
  },
  {
    legacy_firebase_uid: 'fb_uid_field_synthetic_03',
    email: 'field@example.com',
    role: 'FIELD_OFFICER',
    department_id: 'WATCO'
  },
  {
    legacy_firebase_uid: 'fb_uid_citizen_synthetic_04',
    email: 'citizen2@example.com',
    role: 'CITIZEN',
    department_id: null
  },
  {
    legacy_firebase_uid: 'fb_uid_citizen_synthetic_05',
    email: 'test-citizen@example.com',
    role: 'CITIZEN',
    department_id: null
  }
];

const HISTORICAL_EXCLUSIONS = [
  'citizen.test@example.com',
  'officer_live_verifier@firebase.civicpulse.local',
  'officer_live_verifier'
];

export async function runProvisioning(isDryRun = false) {
  console.log('===============================================================');
  console.log(` CIVICPULSE AI — SUPABASE AUTH PROVISIONING [${isDryRun ? 'DRY-RUN' : 'LIVE'}]`);
  console.log('===============================================================\n');

  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is required in .env');
  }

  if (!isDryRun && !SUPABASE_SECRET_KEY) {
    throw new Error('SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is required in .env for LIVE provisioning');
  }

  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`Target Accounts: ${PRODUCTION_ACCOUNTS.length} production users`);

  const supabase = SUPABASE_SECRET_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      })
    : null;

  const pgClient = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await pgClient.connect();
  console.log('Connected to PostgreSQL.\n');

  const mappingRecords: any[] = [];
  const operatorRecoveryRecords: any[] = [];

  try {
    // 1. Fetch existing Supabase auth users
    let existingAuthUsers: any[] = [];
    if (supabase) {
      const { data: existingAuthData, error: listError } = await supabase.auth.admin.listUsers({
        perPage: 1000
      });
      if (listError) {
        throw new Error(`Failed to list Supabase auth users: ${listError.message}`);
      }
      existingAuthUsers = existingAuthData?.users || [];
      console.log(`Current Supabase auth.users count: ${existingAuthUsers.length}`);
    } else {
      console.log('SUPABASE_SECRET_KEY not supplied; skipping remote Supabase Auth list in dry-run.');
    }

    // Verify historical exclusions do not exist in Supabase Auth
    for (const excl of HISTORICAL_EXCLUSIONS) {
      const found = existingAuthUsers.find(u => u.email === excl);
      if (found) {
        console.warn(`[WARNING] Historical exclusion ${excl} already exists in Supabase Auth (${found.id})`);
      }
    }

    // 2. Start PostgreSQL Transaction
    if (!isDryRun) {
      await pgClient.query('BEGIN');
    }

    for (const target of PRODUCTION_ACCOUNTS) {
      console.log(`\nProcessing: ${target.email} (${target.role})...`);

      // Verify row exists in public.users
      const userRes = await pgClient.query(
        'SELECT id, legacy_firebase_uid, email, role, department_id, auth_user_id FROM public.users WHERE legacy_firebase_uid = $1 AND email = $2',
        [target.legacy_firebase_uid, target.email]
      );

      if (userRes.rows.length !== 1) {
        throw new Error(`Integrity Error: Expected exactly 1 public.users row for ${target.email}, found ${userRes.rows.length}`);
      }

      const dbUser = userRes.rows[0];

      // Check if user already exists in Supabase Auth
      let authUser = existingAuthUsers.find(u => u.email?.toLowerCase() === target.email.toLowerCase());

      if (!authUser) {
        if (!isDryRun) {
          console.log(`  Creating Supabase auth user for ${target.email}...`);
          const { data: createData, error: createError } = await supabase.auth.admin.createUser({
            email: target.email,
            email_confirm: false, // Rule 6: preserve source unverified state
            user_metadata: {
              source: 'civicpulse_phase15b4_migration',
              legacy_firebase_uid: target.legacy_firebase_uid
            }
          });

          if (createError || !createData.user) {
            throw new Error(`Failed to create Supabase user for ${target.email}: ${createError?.message}`);
          }
          authUser = createData.user;
          console.log(`  ✓ Created Supabase user with ID: ${authUser.id}`);
        } else {
          console.log(`  [DRY-RUN] Would create Supabase auth user for ${target.email}`);
          authUser = { id: `mock-auth-${target.legacy_firebase_uid}`, email: target.email } as any;
        }
      } else {
        console.log(`  ✓ Found existing Supabase auth user with ID: ${authUser.id}`);
      }

      // Generate Recovery Link (Rule 9: LINK_GENERATED)
      let recoveryUrl = '';
      if (!isDryRun) {
        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
          type: 'recovery',
          email: target.email
        });
        if (linkError) {
          console.warn(`  [WARN] Could not generate recovery link for ${target.email}: ${linkError.message}`);
        } else {
          recoveryUrl = linkData?.properties?.action_link || '';
          console.log(`  ✓ Generated recovery action link (Action: LINK_GENERATED)`);
        }
      }

      // Update public.users.auth_user_id
      if (!isDryRun) {
        const updateRes = await pgClient.query(
          `UPDATE public.users
           SET auth_user_id = $1
           WHERE id = $2 AND (auth_user_id IS NULL OR auth_user_id = $1)
           RETURNING id, auth_user_id;`,
          [authUser!.id, dbUser.id]
        );

        if (updateRes.rows.length !== 1) {
          throw new Error(`Failed to update auth_user_id for ${target.email}: Record already mapped or not found`);
        }
        console.log(`  ✓ Updated public.users.auth_user_id = ${authUser!.id}`);
      } else {
        console.log(`  [DRY-RUN] Would update public.users (${dbUser.id}) SET auth_user_id = ${authUser!.id}`);
      }

      mappingRecords.push({
        public_users_id: dbUser.id,
        legacy_firebase_uid: target.legacy_firebase_uid,
        auth_user_id: authUser!.id,
        email: target.email,
        role: target.role,
        department_id: target.department_id,
        source_verification_state: false,
        migrated_verification_state: false,
        recovery_delivery_lifecycle: {
          status: 'LINK_GENERATED',
          delivered: false,
          password_established: false
        },
        migration_status: isDryRun ? 'DRY_RUN' : 'MAPPED'
      });

      if (recoveryUrl) {
        operatorRecoveryRecords.push({
          email: target.email,
          role: target.role,
          action_link: recoveryUrl
        });
      }
    }

    // Explicitly record the 2 HISTORICAL_SYNTHETIC_IDENTITY exclusions
    const historicalUsers = await pgClient.query(
      `SELECT id, legacy_firebase_uid, email, role, department_id, auth_user_id
       FROM public.users
       WHERE legacy_firebase_uid IN ('officer_live_verifier', 'fb_uid_citizen_synthetic_06');`
    );

    for (const h of historicalUsers.rows) {
      if (h.auth_user_id !== null) {
        throw new Error(`Security Violation: Historical identity ${h.legacy_firebase_uid} has non-null auth_user_id!`);
      }
      mappingRecords.push({
        public_users_id: h.id,
        legacy_firebase_uid: h.legacy_firebase_uid,
        auth_user_id: null,
        email: h.email,
        role: h.role,
        department_id: h.department_id,
        source_verification_state: false,
        migrated_verification_state: false,
        recovery_delivery_lifecycle: {
          status: 'NOT_APPLICABLE',
          delivered: false,
          password_established: false
        },
        migration_status: 'HISTORICAL_RETAINED_UNMAPPED'
      });
    }

    if (!isDryRun) {
      await pgClient.query('COMMIT');
      console.log('\nPostgreSQL Transaction COMMITTED successfully.');
    }

    // 3. Post-Condition Verification
    const countRes = await pgClient.query(
      `SELECT count(*)::int as total, count(auth_user_id)::int as mapped FROM public.users;`
    );
    console.log(`\nFinal public.users state: ${countRes.rows[0].mapped} / ${countRes.rows[0].total} mapped.`);
    if (!isDryRun && countRes.rows[0].mapped !== 5) {
      throw new Error(`Post-condition failed: Expected exactly 5 mapped users, found ${countRes.rows[0].mapped}`);
    }

    // 4. Write mapping artifact (without raw secret recovery links)
    const artifactPath = path.resolve(__dirname, '../../migration/auth/firebase-to-supabase-user-map.json');
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, JSON.stringify(mappingRecords, null, 2), 'utf8');
    console.log(`\n✓ Written mapping artifact to: ${artifactPath}`);

    // If recovery links were generated, write them to an operator-only scratch file (never committed to git)
    if (operatorRecoveryRecords.length > 0) {
      const operatorDir = path.resolve(__dirname, '../../.operator');
      fs.mkdirSync(operatorDir, { recursive: true });
      const operatorFile = path.resolve(operatorDir, 'recovery-links.json');
      fs.writeFileSync(operatorFile, JSON.stringify(operatorRecoveryRecords, null, 2), 'utf8');
      console.log(`✓ Stored ${operatorRecoveryRecords.length} recovery links in operator session directory (.operator/recovery-links.json).`);
    }

    return {
      success: true,
      mappedCount: mappingRecords.filter(r => r.auth_user_id !== null).length,
      unmappedCount: mappingRecords.filter(r => r.auth_user_id === null).length
    };
  } catch (err: any) {
    if (!isDryRun) {
      await pgClient.query('ROLLBACK');
      console.error('Transaction ROLLED BACK due to error.');
    }
    throw err;
  } finally {
    await pgClient.end();
  }
}

if (require.main === module) {
  const isDryRun = process.argv.includes('--dry-run');
  runProvisioning(isDryRun)
    .then(res => {
      console.log('\nProvisioning script completed successfully:', res);
      process.exit(0);
    })
    .catch(err => {
      console.error('\nProvisioning script FAILED:', err);
      process.exit(1);
    });
}
