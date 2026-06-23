import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getToken, setToken, clearToken, TOKEN_KEY } from '@/lib/api';

describe('token helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores and reads the token', () => {
    expect(getToken()).toBeNull();
    setToken('abc.def.ghi');
    expect(localStorage.getItem(TOKEN_KEY)).toBe('abc.def.ghi');
    expect(getToken()).toBe('abc.def.ghi');
  });

  it('clears the token', () => {
    setToken('abc');
    clearToken();
    expect(getToken()).toBeNull();
  });

  it('emits devmeme-auth-changed on set and clear', () => {
    const handler = vi.fn();
    window.addEventListener('devmeme-auth-changed', handler);
    setToken('abc');
    clearToken();
    window.removeEventListener('devmeme-auth-changed', handler);
    expect(handler).toHaveBeenCalledTimes(2);
  });
});
