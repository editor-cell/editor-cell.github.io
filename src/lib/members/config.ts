/**
 * Membership, comments and members-only readings.
 *
 * Everything is built and shipped, but nothing shows on the site until `enabled` is true
 * and the two Supabase values are filled in (Supabase → Project Settings → API). The key
 * here is the public one ("anon" or "publishable"); it is meant to sit in page code; the
 * database rules in supabase/orbis-members.sql decide what it may do. The secret
 * ("service_role") key never goes in this file.
 *
 * Steps to switch on: docs/uyelik-etkinlestirme.md.
 */
export const MEMBERS: {
  enabled: boolean;
  supabaseUrl: string;
  supabaseKey: string;
  /** Show "Continue with Google" once Google sign-in is set up in Supabase. */
  google: boolean;
} = {
  enabled: true,
  supabaseUrl: "https://vrfldrnaesfyizjaqveb.supabase.co",
  supabaseKey: "sb_publishable_AUo-RXclC8kmtTUH3Cm49g_VQIQSomV",
  google: false,
};

/** True only when switched on and both Supabase values are present. */
export const membersOn: boolean =
  MEMBERS.enabled && MEMBERS.supabaseUrl.startsWith("https://") && MEMBERS.supabaseKey.length > 0;
