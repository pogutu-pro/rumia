import { sanitizeHtml, stripHtml } from '../sanitize-html';

describe('sanitizeHtml', () => {
  it('keeps allowed formatting tags', () => {
    expect(sanitizeHtml('<h2>Title</h2><p>Hello <strong>bold</strong> <em>it</em></p>')).toBe(
      '<h2>Title</h2><p>Hello <strong>bold</strong> <em>it</em></p>',
    );
  });

  it('keeps lists', () => {
    expect(sanitizeHtml('<ul><li>a</li><li>b</li></ul><ol><li>1</li></ol>')).toBe(
      '<ul><li>a</li><li>b</li></ul><ol><li>1</li></ol>',
    );
  });

  it('strips script tags and their content', () => {
    expect(sanitizeHtml('<p>x</p><script>alert(1)</script><p>y</p>')).toBe('<p>x</p><p>y</p>');
  });

  it('strips event handler attributes and javascript: links', () => {
    const html =
      '<p><a href="javascript:alert(1)" onclick="x()">bad</a> ' +
      '<a href="https://rumia.co.ke" onmouseover="x()">good</a></p>';
    const out = sanitizeHtml(html);
    expect(out).toContain('href="https://rumia.co.ke"');
    expect(out).toContain('<a>bad</a>');
    expect(out).not.toContain('javascript:');
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('onmouseover');
  });

  it('adds safe target/rel to external links', () => {
    const out = sanitizeHtml('<a href="https://example.com">x</a>');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
  });

  it('keeps mailto and relative links', () => {
    expect(sanitizeHtml('<a href="mailto:a@b.c">m</a>')).toContain('href="mailto:a@b.c"');
    expect(sanitizeHtml('<a href="/hostels">h</a>')).toContain('href="/hostels"');
    expect(sanitizeHtml('<a href="#top">t</a>')).toContain('href="#top"');
  });

  it('drops unknown tags but keeps their content', () => {
    expect(sanitizeHtml('<div><p>ok</p></div>')).toBe('<p>ok</p>');
  });

  it('keeps safe ids but drops style and class', () => {
    const out = sanitizeHtml('<h2 id="sec-1" style="color:red" class="x">T</h2>');
    expect(out).toBe('<h2 id="sec-1">T</h2>');
  });

  it('removes empty paragraphs', () => {
    expect(sanitizeHtml('<p>a</p><p></p><p>b</p>')).toBe('<p>a</p><p>b</p>');
  });

  it('does not crash on malformed input', () => {
    expect(sanitizeHtml('<p><strong>unclosed')).toContain('unclosed');
    expect(sanitizeHtml('plain text')).toBe('plain text');
    expect(sanitizeHtml(null)).toBe('');
  });
});

describe('stripHtml', () => {
  it('returns plain text', () => {
    expect(stripHtml('<h2>T</h2><p>Hello <strong>world</strong></p>')).toBe('T Hello world');
  });
});