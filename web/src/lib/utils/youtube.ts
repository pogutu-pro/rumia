const YOUTUBE_ID = /^[\w-]{11}$/;

/** Pull the 11-character video id out of a YouTube link (watch, youtu.be, embed, shorts) or a bare id. Returns '' when none is found. */
export function parseYoutube(input: string): { id: string; isShort: boolean } {
  const raw = (input ?? '').trim();
  if (!raw) return { id: '', isShort: false };
  if (YOUTUBE_ID.test(raw)) return { id: raw, isShort: false };
  const match = raw.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|shorts\/|live\/|v\/)|[?&]v=)([\w-]{11})/,
  );
  if (!match) return { id: '', isShort: false };
  return { id: match[1], isShort: /\/shorts\//i.test(raw) };
}
