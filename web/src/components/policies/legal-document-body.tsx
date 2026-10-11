/**
 * Renders the sanitized HTML body of a legal document (Terms / Privacy) on the
 * public pages. Styling comes from the shared `.legal-document-prose` class so
 * both documents stay visually consistent and responsive.
 */
export function LegalDocumentBody({ html }: { html: string }) {
  return (
    <div
      className="legal-document-prose"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}