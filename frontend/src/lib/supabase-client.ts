import { createClient, SupabaseClient, User as SupabaseUser, Session } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

/**
 * Validates that a key is not a backend-only secret or service-role credential.
 * Secret keys must never be exposed or passed to the browser-side Supabase client.
 */
export function isSecretApiKey(key: string): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  return (
    trimmed.startsWith('sb_secret_') ||
    trimmed.startsWith('sbp_') ||
    trimmed.includes('service_role')
  );
}

export function isSupabaseConfigured(): boolean {
  if (!supabaseUrl || !supabasePublishableKey) {
    return false;
  }
  if (isSecretApiKey(supabasePublishableKey)) {
    if (typeof window !== 'undefined') {
      console.error(
        '[Supabase Client Security Guard] Forbidden use of secret API key in browser. ' +
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be a publishable (or anon) key, never a secret or service-role key.'
      );
    }
    return false;
  }
  return true;
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }

  return supabaseInstance;
}

export async function signInWithEmail(email: string, pass: string): Promise<{ user: SupabaseUser; session: Session | null }> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase Auth is not configured on this client. Please check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  }

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: pass
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error('Authentication failed: No user returned.');
  }

  return { user: data.user, session: data.session };
}

export async function signUpWithEmail(
  email: string,
  pass: string,
  fullName?: string,
  redirectUrl?: string
): Promise<{ user: SupabaseUser; session: Session | null }> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase Auth is not configured on this client. Please check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  }

  // Derive confirmation redirect URL from environment or current browser window origin
  const redirectTo =
    redirectUrl ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : process.env.NEXT_PUBLIC_SITE_URL
      ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
      : undefined);

  const { data, error } = await client.auth.signUp({
    email,
    password: pass,
    options: {
      emailRedirectTo: redirectTo,
      data: {
        full_name: fullName || email.split('@')[0]
      }
    }
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error('Registration failed: No user returned from Supabase Auth.');
  }

  return { user: data.user, session: data.session };
}

export async function signOutUser(): Promise<void> {
  const client = getSupabaseClient();
  if (client) {
    await client.auth.signOut();
  }
}

export function onAuthChange(callback: (user: SupabaseUser | null, session: Session | null) => void): () => void {
  const client = getSupabaseClient();
  if (!client) {
    callback(null, null);
    return () => {};
  }

  const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null, session || null);
  });

  return () => {
    subscription.unsubscribe();
  };
}

export async function getCurrentSessionToken(): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client) {
    return null;
  }

  const { data: { session } } = await client.auth.getSession();
  return session?.access_token || null;
}

export async function resetPasswordForEmail(email: string, redirectTo?: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase Auth is not configured on this client. Please check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  }

  const targetRedirect =
    redirectTo ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}/update-password`
      : undefined);

  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: targetRedirect
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateUserPassword(newPassword: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase Auth is not configured on this client. Please check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  }

  const { error } = await client.auth.updateUser({
    password: newPassword
  });

  if (error) {
    throw new Error(error.message);
  }
}
