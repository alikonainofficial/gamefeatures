/**
 * Demo-mode settings for the public deployment (NEXT_PUBLIC_* values are inlined into the
 * browser bundle at build time).
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

/** Password of the seeded demo accounts. Public on purpose (the seed's SEED_DEMO_PASSWORD). */
export const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD || 'try-the-demo';

export const DEMO_ACCOUNTS = [
  { label: 'Try as gamer', email: 'demo_gamer@demo.gamefeatures.dev' },
  { label: 'Try as developer', email: 'demo_dev@demo.gamefeatures.dev' },
] as const;

export type OAuthProvider = 'google' | 'twitch';
const ALL_PROVIDERS: OAuthProvider[] = ['google', 'twitch'];

/**
 * Which OAuth buttons the login page shows. NEXT_PUBLIC_OAUTH_PROVIDERS (comma-separated)
 * decides when it is set. When it is unset, the demo hides both (no OAuth credentials are
 * configured there) and other setups keep showing both, as before.
 */
export function oauthProvidersFrom(value: string | undefined, demoMode: boolean): OAuthProvider[] {
  if (value === undefined) return demoMode ? [] : ALL_PROVIDERS;
  const listed = value.split(',').map((name) => name.trim().toLowerCase());
  return ALL_PROVIDERS.filter((provider) => listed.includes(provider));
}

export const OAUTH_PROVIDERS = oauthProvidersFrom(
  process.env.NEXT_PUBLIC_OAUTH_PROVIDERS,
  DEMO_MODE,
);
