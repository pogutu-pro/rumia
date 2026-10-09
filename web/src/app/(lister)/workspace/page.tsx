import type { Metadata } from 'next';
import { WorkspaceScreen } from '@/components/rumia/workspace/workspace-screen';

export const metadata: Metadata = {
  title: 'Workspace · Rumia',
  description: 'What needs your attention today: confirm availabilities, answer contacts and keep your places in search.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function WorkspacePage() {
  return <WorkspaceScreen />;
}
