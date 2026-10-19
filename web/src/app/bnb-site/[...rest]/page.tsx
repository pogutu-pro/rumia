import { notFound } from 'next/navigation';

/** Any unknown RumiaBnB path renders the RumiaBnB 404 (bnb-site/not-found.tsx) instead of Rumia's root one. */
export default function UnknownBnbPath() {
  notFound();
}
