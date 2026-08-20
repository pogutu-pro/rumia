-- Legal / Policies documents for the Admin Dashboard.
--
-- Terms & Conditions and Privacy Policy used to be hardcoded as React JSX in
-- src/app/terms/page.tsx and src/app/policy/page.tsx. This migration moves the
-- content into the database so authorized admins can edit and publish legal
-- documents without touching the codebase.
--
-- Design:
--   * A single `legal_documents` table holds a row per document type
--     (`terms` | `privacy`) rather than a table per policy.
--   * `status` supports a draft workflow: 'draft' rows are only visible to
--     admins, public pages only ever read 'published' rows. The database
--     enforces this so the public never sees or fetches drafts.
--   * Public SELECT is filtered to published rows; admin write access is gated
--     by the existing is_campus_super_admin() helper (profiles.role = 'admin'),
--     matching the Rumia RLS conventions used by reviews/announcements.
--   * Existing hardcoded content is preserved and seeded as the two initial
--     published documents (effective June 1, 2025) so nothing is lost.

BEGIN;

CREATE TABLE IF NOT EXISTS public.legal_documents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type           TEXT NOT NULL UNIQUE
                   CHECK (type IN ('terms', 'privacy')),
  -- Live content shown on the public pages when status = 'published'.
  content        TEXT NOT NULL,
  -- Unpublished edits being worked on. Keeping drafts separate from `content`
  -- means saving a draft never changes the live policy until Publish is used.
  draft_content  TEXT,
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'published')),
  effective_date DATE,
  published_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Public lookup: WHERE type = ? AND status = 'published'
CREATE INDEX IF NOT EXISTS idx_legal_documents_type_status
  ON public.legal_documents (type, status);

CREATE OR REPLACE TRIGGER legal_documents_updated_at
  BEFORE UPDATE ON public.legal_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

-- ── Public read ─────────────────────────────────────────────────────────
-- Only published documents are ever readable by the public. Drafts are
-- invisible at the database level so public pages never fetch them.
DROP POLICY IF EXISTS "legal_documents_select_public" ON public.legal_documents;
CREATE POLICY "legal_documents_select_public"
  ON public.legal_documents FOR SELECT
  USING (status = 'published');

-- ── Admin access ─────────────────────────────────────────────────────────
-- `admin` (is_campus_super_admin) is the single top role; only admins can
-- create, edit, or publish legal documents. Normal authenticated users and
-- managers have no write access.
DROP POLICY IF EXISTS "legal_documents_select_admin" ON public.legal_documents;
CREATE POLICY "legal_documents_select_admin"
  ON public.legal_documents FOR SELECT
  TO authenticated
  USING (is_campus_super_admin());

DROP POLICY IF EXISTS "legal_documents_insert_admin" ON public.legal_documents;
CREATE POLICY "legal_documents_insert_admin"
  ON public.legal_documents FOR INSERT
  TO authenticated
  WITH CHECK (is_campus_super_admin());

DROP POLICY IF EXISTS "legal_documents_update_admin" ON public.legal_documents;
CREATE POLICY "legal_documents_update_admin"
  ON public.legal_documents FOR UPDATE
  TO authenticated
  USING (is_campus_super_admin())
  WITH CHECK (is_campus_super_admin());

DROP POLICY IF EXISTS "legal_documents_delete_admin" ON public.legal_documents;
CREATE POLICY "legal_documents_delete_admin"
  ON public.legal_documents FOR DELETE
  TO authenticated
  USING (is_campus_super_admin());

-- ── Seed: migrate existing hardcoded content ─────────────────────────────
-- Preserves the Terms of Service and Privacy Policy text that previously
-- lived in src/app/terms/page.tsx and src/app/policy/page.tsx, converted to
-- HTML and seeded as published documents.
INSERT INTO public.legal_documents (type, content, status, effective_date, published_at)
VALUES
('terms', $legal$
<h2 id="1-acceptance-of-terms">1. Acceptance of Terms</h2>
<p>By accessing or using Rumia, you agree to be bound by these Terms of Service. If you do not agree, do not use the platform. These terms apply to all users including students, student agents, and any landlords who interact with the platform.</p>
<h2 id="2-what-rumia-is-and-is-not">2. What Rumia Is (and Is Not)</h2>
<p>Rumia is a hostel listing and lead generation platform. We connect students looking for accommodation near DeKUT with student agents who list available rooms on behalf of landlords.</p>
<p>Rumia is not a rental agency. We do not own, manage, or guarantee any of the properties listed on the platform. We do not handle rent payments, tenancy agreements, or disputes between tenants and landlords. Any rental arrangement is strictly between the student, the agent, and the landlord.</p>
<h2 id="3-contact-flow-and-phone-numbers">3. Contact Flow and Phone Numbers</h2>
<p>When you choose to contact a listing on Rumia, you are presented with two options: Hostel Owner (direct contact with the landlord or caretaker) and Rumia Agent (contact through a student agent for guided assistance).</p>
<p>To initiate contact, you must be signed in and have a valid Kenyan phone number saved to your profile. Your phone number is shared with the agent or landlord so they can respond to your enquiry via WhatsApp.</p>
<p>Rumia collects and logs contact leads for commission tracking purposes. By contacting an agent or landlord through Rumia, you consent to your name and phone number being shared with that party.</p>
<h2 id="4-student-responsibilities">4. Student Responsibilities</h2>
<ul>
<li>Provide accurate personal information — including a valid Kenyan phone number — when registering or contacting an agent</li>
<li>Use the platform only to find genuine accommodation for yourself</li>
<li>Not misrepresent your identity or contact multiple agents for the same room simultaneously with no intent to rent</li>
<li>Not use Rumia's agent contact details for spam or any purpose unrelated to finding accommodation</li>
<li>Verify room conditions in person before paying any deposit or signing any agreement</li>
</ul>
<h2 id="5-agent-responsibilities">5. Agent Responsibilities</h2>
<ul>
<li>Only list rooms that are genuinely available and accurately described</li>
<li>Keep your listings up to date — mark rooms as taken once they are filled</li>
<li>Not inflate pricing, misrepresent room conditions, or use misleading photos</li>
<li>Respond to genuine student enquiries in good faith</li>
<li>Not list rooms without the knowledge and approval of the landlord or caretaker</li>
<li>Provide accurate phone numbers for both the agent WhatsApp and the hostel owner/landlord</li>
</ul>
<blockquote>Rumia reserves the right to remove any listing that is reported as inaccurate, misleading, or no longer available, and to suspend agents who repeatedly violate this.</blockquote>
<h2 id="6-lead-generation-and-commission">6. Lead Generation and Commission</h2>
<p>Rumia operates on a lead generation model. When a student contacts an agent through Rumia and subsequently moves into the listed property, a commission fee is owed to Rumia by the landlord.</p>
<p>Some hostels are designated as commission-paying (managed by Rumia agents with landlord agreements), while others are not. The commission status is displayed on each listing.</p>
<ul>
<li>The commission split is 40% to Rumia, 60% to the agent, based on the agreed commission rate with the landlord.</li>
<li>Rumia's 40% share is non-negotiable and forms the basis of our business model.</li>
<li>For non-commission hostels, a consultation fee may apply when contacting a Rumia Agent (as set by the campus manager). This fee is paid directly to the agent and is clearly disclosed before the contact is made.</li>
<li>Agents and landlords who attempt to circumvent this arrangement — for example by redirecting students off-platform to avoid commission attribution — are in breach of these terms and will be permanently removed from the platform.</li>
</ul>
<h2 id="7-tour-bookings-and-pricing">7. Tour Bookings and Pricing</h2>
<p>Rumia offers a guided hostel tour service where a student agent accompanies you to visit hostels in person. Tours must be booked and paid for through the platform before the visit.</p>
<ul>
<li>Zone tour (from a listing details page or the /book-tour page): pricing varies by zone (KSh 600 – KSh 1,500 depending on the area) — you can visit one or more hostels in the same zone</li>
<li>The price is the same for the whole zone regardless of how many hostels you visit</li>
<li>Tour bookings are confirmed only after payment. Cancellations must be made at least 24 hours before the scheduled tour</li>
<li>Rumia is not responsible for the outcome of any tour — a tour does not guarantee a room will be available</li>
</ul>
<h2 id="8-prohibited-conduct">8. Prohibited Conduct</h2>
<ul>
<li>Creating fake, duplicate, or misleading listings</li>
<li>Impersonating another agent, student, or landlord</li>
<li>Deliberately redirecting students away from Rumia's tracked contact flow to avoid commission</li>
<li>Harassing or spamming other users</li>
<li>Using automated tools to scrape listings or contact information</li>
<li>Providing false phone numbers or contact details</li>
<li>Any activity that violates Kenyan law</li>
</ul>
<blockquote>Violations may result in immediate account suspension without notice.</blockquote>
<h2 id="9-intellectual-property">9. Intellectual Property</h2>
<p>The Rumia name, logo, platform design, and all content created by Stratnovo are the intellectual property of Stratnovo. You may not reproduce, copy, or use any part of the platform for commercial purposes without written permission.</p>
<p>User-submitted content (listing photos, descriptions) remains the property of the submitter. By uploading content to Rumia, you grant Stratnovo a non-exclusive licence to display that content on the platform.</p>
<h2 id="10-disclaimers">10. Disclaimers</h2>
<p>Rumia facilitates connections between students and agents. We are not responsible for:</p>
<ul>
<li>The accuracy of any listing submitted by an agent</li>
<li>The conduct of any agent, landlord, or student using the platform</li>
<li>Any dispute arising from a rental arrangement made through Rumia</li>
<li>Any loss, damage, or dissatisfaction resulting from accommodation found through the platform</li>
<li>WhatsApp availability or delivery of messages — WhatsApp is operated by a third party and is outside Rumia's control</li>
</ul>
<blockquote>Use Rumia's listings as a starting point. Always verify room conditions in person before paying any deposit or signing any agreement.</blockquote>
<h2 id="11-account-termination">11. Account Termination</h2>
<p>Rumia reserves the right to suspend or permanently terminate any account that violates these Terms of Service, engages in fraudulent activity, or damages the reputation or operation of the platform. No refund of any kind will be issued upon termination for cause. You may delete your own account at any time by contacting us at legal@rumia.co.ke.</p>
<h2 id="12-governing-law">12. Governing Law</h2>
<p>These Terms of Service are governed by the laws of the Republic of Kenya. Any disputes arising from the use of Rumia shall be subject to the jurisdiction of Kenyan courts.</p>
<h2 id="13-contact">13. Contact</h2>
<p>Email: legal@rumia.co.ke</p>
<p>Company: Stratnovo, Nyeri, Kenya</p>
$legal$, 'published', '2025-06-01', now()),

('privacy', $legal$
<h2 id="1-introduction">1. Introduction</h2>
<p>Rumia is a hostel discovery platform operated by Stratnovo, a technology company registered in Kenya. This Privacy Policy explains how we collect, use, and protect information when you use Rumia to find student accommodation near Dedan Kimathi University of Technology (DeKUT) in Nyeri, Kenya. By using Rumia, you agree to the practices described in this policy.</p>
<h2 id="2-information-we-collect">2. Information We Collect</h2>
<p><strong>Information you provide:</strong></p>
<ul>
<li>Full name (from Google OAuth or manual input)</li>
<li>Email address</li>
<li>Phone number (required to contact agents or landlords via WhatsApp)</li>
<li>University and year of study</li>
<li>Tour booking preferences (hostel selection, preferred date and time)</li>
</ul>
<p><strong>Information collected automatically:</strong></p>
<ul>
<li>Pages and listings you view</li>
<li>Search terms and filters used</li>
<li>Device type, browser, and approximate location</li>
<li>Time and frequency of visits</li>
</ul>
<h2 id="3-how-we-use-your-information">3. How We Use Your Information</h2>
<ul>
<li>Display relevant hostel listings based on your search and location preferences</li>
<li>Connect you with student agents or landlords when you initiate contact through WhatsApp</li>
<li>Track contact leads for commission attribution and platform operations</li>
<li>Process and manage tour bookings</li>
<li>Send platform notifications and updates (WhatsApp or email)</li>
<li>Improve search results, listing quality, and platform performance</li>
<li>Detect and prevent fraudulent listings or abuse</li>
</ul>
<blockquote>We do not use your information for unrelated advertising.</blockquote>
<h2 id="4-information-sharing">4. Information Sharing</h2>
<ul>
<li>When you choose to contact an agent or landlord through Rumia, your name and phone number are shared with that party via WhatsApp so they can respond to your enquiry.</li>
<li>When you book a tour, your name, phone number, and tour preferences are shared with the assigned student agent.</li>
<li>We do not sell your personal data to third parties. We may share data with:</li>
</ul>
<ul>
<li>Infrastructure providers (secure servers for database hosting, Cloudflare for CDN and storage) under strict data processing terms</li>
<li>Analytics tools to understand platform usage in aggregate</li>
<li>Law enforcement if required by Kenyan law</li>
</ul>
<blockquote>WhatsApp communication happens outside Rumia's control. Once your phone number is shared with an agent or landlord via WhatsApp, Rumia cannot control how that party uses your information.</blockquote>
<h2 id="5-data-storage-and-security">5. Data Storage and Security</h2>
<p>Your data is stored on secure cloud infrastructure with industry-standard security measures including encryption at rest and in transit. Access to personal data is restricted to authorised Stratnovo personnel only. No system is completely secure. If you suspect unauthorised access to your account, contact us immediately.</p>
<h2 id="6-cookies-and-session-data">6. Cookies and Session Data</h2>
<ul>
<li>Keeping you logged in (session cookies)</li>
<li>Storing your pending contact state during OAuth redirects (session storage, cleared after use)</li>
<li>Understanding how users navigate the platform (analytics)</li>
</ul>
<blockquote>You can disable cookies in your browser settings, though some features may not work correctly.</blockquote>
<h2 id="7-your-rights">7. Your Rights</h2>
<ul>
<li>Request a copy of the data we hold about you</li>
<li>Request correction of inaccurate data</li>
<li>Request deletion of your account and associated data</li>
<li>Opt out of non-essential data collection</li>
</ul>
<blockquote>To exercise any of these rights, email privacy@rumia.co.ke. We will respond within 14 days.</blockquote>
<h2 id="8-childrens-policy">8. Children's Policy</h2>
<p>Rumia is intended for university students aged 18 and above. We do not knowingly collect data from minors. If you believe a minor has registered, contact us and we will remove their account.</p>
<h2 id="9-changes-to-this-policy">9. Changes to This Policy</h2>
<p>We may update this Privacy Policy from time to time. When we do, we will update the "Last Updated" date at the top of this page. Continued use of Rumia after changes are posted constitutes your acceptance of the updated policy.</p>
<h2 id="10-contact">10. Contact</h2>
<p>Email: privacy@rumia.co.ke</p>
<p>Company: Stratnovo, Nyeri, Kenya</p>
$legal$, 'published', '2025-06-01', now())

ON CONFLICT (type) DO NOTHING;

COMMIT;