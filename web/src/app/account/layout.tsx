import { AppShell } from '@/components/shell';
import { RumiaChrome } from '@/components/shell/rumia-chrome';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <RumiaChrome>
      <AppShell>{children}</AppShell>
    </RumiaChrome>
  );
}
