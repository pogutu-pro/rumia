import { describe, expect, it } from 'vitest';
import { parseYoutube } from '../youtube';

describe('parseYoutube', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5s', 'dQw4w9WgXcQ', false],
    ['https://youtu.be/dQw4w9WgXcQ?si=x', 'dQw4w9WgXcQ', false],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ', false],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ', true],
    ['dQw4w9WgXcQ', 'dQw4w9WgXcQ', false],
  ])('%s', (input, id, isShort) => {
    expect(parseYoutube(input)).toEqual({ id, isShort });
  });

  it('returns an empty id for non-YouTube input', () => {
    expect(parseYoutube('https://example.com/video')).toEqual({ id: '', isShort: false });
    expect(parseYoutube('')).toEqual({ id: '', isShort: false });
  });
});
