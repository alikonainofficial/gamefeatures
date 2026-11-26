import { primaryWebUrl, webOrigins } from './web-origins';

describe('webOrigins', () => {
  it('defaults to the local web app', () => {
    expect(webOrigins(undefined)).toEqual(['http://localhost:3000']);
    expect(webOrigins('')).toEqual(['http://localhost:3000']);
    expect(webOrigins(' , ')).toEqual(['http://localhost:3000']);
  });

  it('accepts a single origin', () => {
    expect(webOrigins('https://gamefeatures.vercel.app')).toEqual([
      'https://gamefeatures.vercel.app',
    ]);
  });

  it('splits a comma-separated list, trimming spaces and trailing slashes', () => {
    expect(webOrigins('https://a.example/, http://localhost:3000 ,https://b.example')).toEqual([
      'https://a.example',
      'http://localhost:3000',
      'https://b.example',
    ]);
  });
});

describe('primaryWebUrl', () => {
  it('is the first entry (OAuth redirects there)', () => {
    expect(primaryWebUrl('https://a.example, https://b.example')).toBe('https://a.example');
    expect(primaryWebUrl(undefined)).toBe('http://localhost:3000');
  });
});
