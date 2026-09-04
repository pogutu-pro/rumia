import * as AuthSession from 'expo-auth-session';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '../../lib/supabase/client';

WebBrowser.maybeCompleteAuthSession();

export class AuthFlowCancelledError extends Error {
  constructor() {
    super('Sign in was cancelled.');
    this.name = 'AuthFlowCancelledError';
  }
}

export function getAuthRedirectUri() {
  return AuthSession.makeRedirectUri({
    scheme: 'rumia',
    path: 'auth/callback',
  });
}

export async function signInWithGoogle() {
  const redirectTo = getAuthRedirectUri();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      scopes: 'openid profile email',
      skipBrowserRedirect: true,
      queryParams: {
        prompt: 'select_account',
      },
    },
  });

  if (error) {
    throw error;
  }
  if (!data.url) {
    throw new Error('Google sign in could not start.');
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') {
    throw new AuthFlowCancelledError();
  }

  const parsed = Linking.parse(result.url);
  const code = typeof parsed.queryParams?.code === 'string' ? parsed.queryParams.code : null;
  const oauthError =
    typeof parsed.queryParams?.error_description === 'string'
      ? parsed.queryParams.error_description
      : typeof parsed.queryParams?.error === 'string'
        ? parsed.queryParams.error
        : null;

  if (oauthError) {
    throw new Error(oauthError);
  }
  if (!code) {
    throw new Error('Google sign in returned without an authorization code.');
  }

  const flowId =
    typeof parsed.queryParams?.sb_flow_id === 'string'
      ? parsed.queryParams.sb_flow_id
      : data.flowId || undefined;
  const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    code,
    flowId ? { flowId } : undefined,
  );

  if (exchangeError) {
    throw exchangeError;
  }
  if (!sessionData.session) {
    throw new Error('Google sign in did not return a session.');
  }

  return sessionData.session;
}
