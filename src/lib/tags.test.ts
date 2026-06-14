import { describe, it, expect } from 'vitest';
import { parseTags } from './tags';

describe('parseTags', () => {
  it('splits on commas and whitespace', () => {
    expect(parseTags('react, typescript golang')).toEqual(['react', 'typescript', 'golang']);
  });
  it('lowercases and strips a leading #', () => {
    expect(parseTags('#React, #TS')).toEqual(['react', 'ts']);
  });
  it('deduplicates', () => {
    expect(parseTags('go, go, golang')).toEqual(['go', 'golang']);
  });
  it('drops invalid tags', () => {
    // leading symbol, spaces handled by split; "a b" splits; "!" invalid
    expect(parseTags('valid, !!!, -nope')).toEqual(['valid']);
  });
  it('returns empty array for empty input', () => {
    expect(parseTags('')).toEqual([]);
    expect(parseTags('   ')).toEqual([]);
  });
  it('caps tag length to 31 chars max pattern', () => {
    expect(parseTags('a'.repeat(40))).toEqual([]); // exceeds {0,30} -> rejected
    expect(parseTags('a'.repeat(31))).toEqual(['a'.repeat(31)]);
  });
});
