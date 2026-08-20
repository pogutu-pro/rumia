/**
 * Dependency-free, allow-list HTML sanitizer used for legal documents.
 *
 * Rationale: Terms & Privacy content is authored by admins inside the admin
 * dashboard and later rendered on the public pages with
 * `dangerouslySetInnerHTML`. We keep a strict allow-list of formatting tags and
 * strip every attribute except `href`/`id`, re-adding safe `target`/`rel` for
 * external links. This prevents stored XSS (script/style tags, event handler
 * attributes, javascript: URLs) while letting admins use the formatting the
 * editor exposes: headings, paragraphs, emphasis, lists and links.
 *
 * It is intentionally NOT a general-purpose sanitizer — only the subset of
 * HTML the Rumia editor can produce is preserved.
 */

const ALLOWED_TAGS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'ul',
  'ol',
  'li',
  'a',
  'br',
  'blockquote',
  'hr',
]);

/** Tags whose entire body (until the matching close) is dropped. */
const SKIP_CONTENT_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'noscript',
  'template',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'svg',
  'math',
]);

const VOID_TAGS = new Set(['br', 'hr']);

const SAFE_ID_RE = /^[a-zA-Z][a-zA-Z0-9._:-]*$/;

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function isSafeHref(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed) return false;
  if (/^(https?|mailto|tel):/i.test(trimmed)) return true;
  // Relative links and in-page anchors are fine; protocol-relative is rejected
  // because it could still point at non-http schemes once a page site is loaded.
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return true;
  return false;
}

function pickAttributes(tagName: string, rawAttrs: string): string {
  const kept: string[] = [];

  const attrs =
    rawAttrs.match(/([a-zA-Z-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g) || [];

  for (const attr of attrs) {
    const m = attr.match(/^([a-zA-Z-]+)/);
    if (!m) continue;
    const name = m[1].toLowerCase();
    let value = '';
    const valMatch = attr.match(/^[a-zA-Z-]+(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/);
    if (valMatch) value = valMatch[1] ?? valMatch[2] ?? valMatch[3] ?? '';

    if (name.startsWith('on')) continue;

    if (tagName === 'a' && name === 'href') {
      const href = value.trim();
      if (isSafeHref(href)) {
        kept.push(`href="${escapeAttribute(href)}"`);
        if (/^https?:/i.test(href)) {
          kept.push('target="_blank" rel="noopener noreferrer nofollow"');
        }
      }
      continue;
    }

    if (name === 'id' && SAFE_ID_RE.test(value.trim())) {
      kept.push(`id="${escapeAttribute(value.trim())}"`);
    }
  }

  return kept.length ? ' ' + kept.join(' ') : '';
}

export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return '';

  let src = String(input);
  // Strip HTML comments (may hide script in some parsers).
  src = src.replace(/<!--[\s\S]*?-->/g, '');

  const out: string[] = [];
  let sinkTag: string | null = null;

  const tokens = src.split(/(<\/?[a-zA-Z][^>]*>)/g);

  for (const token of tokens) {
    if (!token) continue;

    if (!token.startsWith('<')) {
      if (!sinkTag) out.push(token);
      continue;
    }

    const close = token.match(/^<\/([a-zA-Z][a-zA-Z0-9]*)>\s*$/);
    if (close) {
      const name = close[1].toLowerCase();
      if (sinkTag) {
        if (name === sinkTag) sinkTag = null;
        continue;
      }
      if (ALLOWED_TAGS.has(name)) out.push(`</${name}>`);
      continue;
    }

    const selfClosing = token.match(/^<([a-zA-Z][a-zA-Z0-9]*)\s*\/?>\s*$/);
    const opener = token.match(/^<([a-zA-Z][a-zA-Z0-9]*)([\s\S]*?)>/);
    if (!opener) continue;

    const name = opener[1].toLowerCase();
    const isVoid = VOID_TAGS.has(name);

    if (SKIP_CONTENT_TAGS.has(name)) {
      sinkTag = name;
      continue;
    }
    if (!ALLOWED_TAGS.has(name)) continue;
    if (selfClosing) {
      out.push(`<${name}${pickAttributes(name, '')}${isVoid ? ' /' : ''}>`);
      continue;
    }
    if (isVoid) {
      out.push(`<${name}${pickAttributes(name, opener[2] ?? '')} />`);
      continue;
    }

    out.push(`<${name}${pickAttributes(name, opener[2] ?? '')}>`);
  }

  let result = out.join('');
  // Drop paragraphs that contain nothing but whitespace (editor leaves these
  // behind when content is cleared or a heading is converted to a paragraph).
  result = result.replace(/<p>\s*<\/p>/g, '');
  return result;
}

/** Strips formatting (used for card previews); never renders untrusted input. */
export function stripHtml(input: string | null | undefined): string {
  if (!input) return '';
  return String(input)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}