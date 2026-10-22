import { AuthShell } from '@/components/auth/auth-shell';

/** Sign-in and first-time setup share one full-screen frame, without the app's navigation around it. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
