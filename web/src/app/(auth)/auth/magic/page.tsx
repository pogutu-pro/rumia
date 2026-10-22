import type { Metadata } from 'next';
import { MagicSignIn } from '@/components/auth/magic-sign-in';

export const metadata: Metadata = {
  title: 'Signing you in',
  robots: { index: false },
};

export default function MagicLinkPage() {
  return <MagicSignIn />;
}
