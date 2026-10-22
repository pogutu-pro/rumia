/** @jest-environment jsdom */
import { chunkUrlFrom, isGoneFromServer } from '../chunk-recovery';

const respond = (status: number) => jest.fn().mockResolvedValue({ status }) as unknown as typeof fetch;

describe('isGoneFromServer', () => {
  it('only a 404 or 410 means the build changed', async () => {
    expect(await isGoneFromServer('/_next/static/chunks/a.js', respond(404))).toBe(true);
    expect(await isGoneFromServer('/_next/static/chunks/a.js', respond(410))).toBe(true);
    expect(await isGoneFromServer('/_next/static/chunks/a.js', respond(200))).toBe(false);
    expect(await isGoneFromServer('/_next/static/chunks/a.js', respond(503))).toBe(false);
  });

  it('a dropped connection is not a new build', async () => {
    const offline = jest.fn().mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;
    expect(await isGoneFromServer('/_next/static/chunks/a.js', offline)).toBe(false);
  });
});

describe('chunkUrlFrom', () => {
  it('finds the chunk a load error names', () => {
    const err = new Error('Loading chunk 9063 failed. (error: https://rumia.co.ke/_next/static/chunks/9063-abc.js)');
    expect(chunkUrlFrom(err)).toBe('https://rumia.co.ke/_next/static/chunks/9063-abc.js');
  });

  it('returns null when no file is named', () => {
    expect(chunkUrlFrom(new TypeError('l[e] is not a function'))).toBeNull();
  });
});
