import type { Campus } from '@/types';

// Client-safe campus registry fallback (pure data, no server imports).
// Mirrors the exact production literals so any DB hiccup still renders
// byte-identical output (stale rather than blank/broken).
export const DEKUT_CAMPUS_FALLBACK: Campus = {
  id: 'dekut',
  slug: 'dekut',
  name: 'Dedan Kimathi University of Technology',
  city: 'Nyeri',
  hero_headline: 'Student Hostels Near DeKUT, Nyeri',
  hero_subtext:
    'Discover verified student hostels near Dedan Kimathi University of Technology in Nyeri, Kenya. Contact agents directly on WhatsApp and book a tour.',
  whatsapp_number: '+254114845619',
  primary_color: '#10B981',
  feature_flags: {
    landing_chips: ['Near Gate A', 'Boma', 'Nyeri'],
    landing_zones:
      'around Boma, near Gate A, and throughout the surrounding Nyeri neighbourhoods.',
    landing_seo_description:
      'Find verified student hostels near Dedan Kimathi University of Technology in Nyeri. Self-contained, single, and shared rooms in Boma, Nyeri View, Nyaribo and Gate A. Book today.',
  },
  seo_title: 'Find Student Hostels Near DeKUT Nyeri',
  seo_description:
    'Discover verified student hostels near Dedan Kimathi University of Technology in Nyeri. Browse self-contained and shared rooms with direct agent contact. No fees.',
  seo_keywords: [
    'student hostels near DeKUT',
    'student accommodation Nyeri',
    'DeKUT hostels',
    'Dedan Kimathi University hostels',
    'student housing Nyeri Kenya',
    'verified hostels near DeKUT',
  ],
  og_title: 'Find Student Hostels Near DeKUT Nyeri | Rumia',
  og_description:
    'Discover verified student hostels near Dedan Kimathi University of Technology, Nyeri. Browse self-contained & shared rooms. Contact agents directly on WhatsApp.',
  twitter_description:
    'Discover verified student hostels near Dedan Kimathi University of Technology, Nyeri. Browse self-contained & shared rooms.',
  manifest_name: 'Rumia — DeKUT Hostels',
  manifest_description: 'Find verified student hostels near DeKUT, Nyeri.',
  short_name: 'DeKUT',
  hero_image: '/dekut.jpeg',
  status: 'active',
  created_at: '2026-08-07T00:00:00Z',
};
