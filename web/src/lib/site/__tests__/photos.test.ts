import { isPortrait, mostlyPortrait, photoUrl } from '../photos';

const R2 = 'https://pub-x.r2.dev/listing/1_ab';

describe('photoUrl', () => {
  it('swaps the stored variant for the requested uncropped size', () => {
    expect(photoUrl(`${R2}/card.webp`, 'gallery')).toBe(`${R2}/gallery.webp`);
    expect(photoUrl(`${R2}/original.jpg`, 'large')).toBe(`${R2}/large.jpg`);
    expect(photoUrl(`${R2}/gallery.webp`, 'thumb')).toBe(`${R2}/thumb.webp`);
  });
  it('leaves other images alone', () => {
    expect(photoUrl('https://img.youtube.com/vi/abc/hqdefault.jpg', 'large')).toBe('https://img.youtube.com/vi/abc/hqdefault.jpg');
  });
});

describe('orientation', () => {
  it('detects phone photos held upright', () => {
    expect(isPortrait({ width: 576, height: 1280 })).toBe(true);
    expect(isPortrait({ width: 1600, height: 1200 })).toBe(false);
    expect(isPortrait({ width: null, height: null })).toBe(false);
  });
  it('switches layout when most photos are portrait', () => {
    const p = { url: 'a', width: 576, height: 1280 };
    const l = { url: 'b', width: 1600, height: 1200 };
    expect(mostlyPortrait([p, p, l])).toBe(true);
    expect(mostlyPortrait([p, l])).toBe(false);
    expect(mostlyPortrait([])).toBe(false);
  });
});
