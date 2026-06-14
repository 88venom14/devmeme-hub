import { describe, it, expect } from 'vitest';
import {
  LIMITS,
  isValidUrl,
  isValidGithubUrl,
  isValidYoutubeUrl,
  isValidTwitchUrl,
  validateUsername,
} from './validation';

describe('LIMITS', () => {
  it('requires a password of at least 8 chars (matches the Go backend)', () => {
    expect(LIMITS.password.min).toBe(8);
  });
});

describe('isValidUrl', () => {
  it('accepts http and https', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://example.com')).toBe(true);
  });
  it('treats blank as valid (optional field)', () => {
    expect(isValidUrl('')).toBe(true);
    expect(isValidUrl('   ')).toBe(true);
  });
  it('rejects non-http(s) and garbage', () => {
    expect(isValidUrl('javascript:alert(1)')).toBe(false);
    expect(isValidUrl('ftp://example.com')).toBe(false);
    expect(isValidUrl('not a url')).toBe(false);
  });
});

describe('isValidGithubUrl', () => {
  it('accepts github.com and www.github.com', () => {
    expect(isValidGithubUrl('https://github.com/user/repo')).toBe(true);
    expect(isValidGithubUrl('https://www.github.com/user/repo')).toBe(true);
  });
  it('rejects other hosts', () => {
    expect(isValidGithubUrl('https://gitlab.com/user/repo')).toBe(false);
    expect(isValidGithubUrl('https://evil.com/github.com')).toBe(false);
  });
});

describe('isValidYoutubeUrl / isValidTwitchUrl', () => {
  it('accepts canonical hosts', () => {
    expect(isValidYoutubeUrl('https://youtube.com/@x')).toBe(true);
    expect(isValidYoutubeUrl('https://youtu.be/abc')).toBe(true);
    expect(isValidTwitchUrl('https://twitch.tv/x')).toBe(true);
  });
  it('rejects unrelated hosts', () => {
    expect(isValidYoutubeUrl('https://vimeo.com/1')).toBe(false);
    expect(isValidTwitchUrl('https://kick.com/x')).toBe(false);
  });
});

describe('validateUsername', () => {
  it('accepts valid usernames', () => {
    expect(validateUsername('john_doe')).toBeNull();
    expect(validateUsername('user-123')).toBeNull();
  });
  it('rejects too short', () => {
    expect(validateUsername('a')).toMatch(/минимум/i);
  });
  it('rejects too long', () => {
    expect(validateUsername('a'.repeat(40))).toMatch(/максимум/i);
  });
  it('rejects invalid characters / leading symbols', () => {
    expect(validateUsername('-bad')).not.toBeNull();
    expect(validateUsername('has space')).not.toBeNull();
    expect(validateUsername('UPPER')).toBeNull(); // lowercased before checking
  });
});
