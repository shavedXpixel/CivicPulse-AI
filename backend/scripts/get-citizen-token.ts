import { createClient } from '@supabase/supabase-js';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../frontend/.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sihttdjkubjuizwdjmrj.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

export async function getCitizenSessionToken(email = 'citizen2@example.com'): Promise<{ accessToken: string; userId: string }> {
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    throw new Error(`Failed to generate magic link: ${linkError?.message}`);
  }

  const publicClient = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: verifyData, error: verifyError } = await publicClient.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink'
  });

  if (verifyError || !verifyData?.session?.access_token) {
    throw new Error(`Failed to exchange token hash for session: ${verifyError?.message}`);
  }

  return {
    accessToken: verifyData.session.access_token,
    refreshToken: verifyData.session.refresh_token,
    userId: verifyData.user.id
  };
}

async function main() {
  const res = await getCitizenSessionToken();
  console.log('Successfully acquired citizen session token!');
  console.log(`Citizen User ID: ${res.userId}`);
  console.log(`Access Token acquired (length: ${res.accessToken.length})`);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Error:', err.message);
    process.exitCode = 1;
  });
}
