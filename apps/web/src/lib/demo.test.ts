import { describe, expect, it } from 'vitest';
import { oauthProvidersFrom } from './demo';

describe('oauthProvidersFrom', () => {
  it('shows only the providers that are listed, ignoring case, spaces and unknown names', () => {
    expect(oauthProvidersFrom('google', true)).toEqual(['google']);
    expect(oauthProvidersFrom(' Twitch , google ', true)).toEqual(['google', 'twitch']);
    expect(oauthProvidersFrom('github,twitch', false)).toEqual(['twitch']);
  });

  it('an explicitly empty list hides both', () => {
    expect(oauthProvidersFrom('', false)).toEqual([]);
  });

  it('when unset, hides both in demo mode and shows both otherwise', () => {
    expect(oauthProvidersFrom(undefined, true)).toEqual([]);
    expect(oauthProvidersFrom(undefined, false)).toEqual(['google', 'twitch']);
  });
});
