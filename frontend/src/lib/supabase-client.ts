import { createClient, SupabaseClient, User as SupabaseUser, Session } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabasePublishableKey);
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
