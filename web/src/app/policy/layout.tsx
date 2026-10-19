import { RumiaChrome } from '@/components/shell/rumia-chrome';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <RumiaChrome>{children}</RumiaChrome>;
}
