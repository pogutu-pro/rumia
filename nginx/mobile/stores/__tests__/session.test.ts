import { useSessionStore } from '../session';

describe('useSessionStore', () => {
  beforeEach(() => {
    useSessionStore.setState({ user: null, isAuthenticated: false, isLoading: true });
  });

  it('starts unauthenticated and loading', () => {
    const state = useSessionStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(true);
  });

  it('setUser hydrates auth state', () => {
    useSessionStore.getState().setUser({
      id: 'u1',
      email: 'a@b.c',
      role: 'student',
      home_campus_confirmed: false,
    });
    const state = useSessionStore.getState();
    expect(state.user?.id).toBe('u1');
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  it('setUser(null) logs out', () => {
    useSessionStore.getState().setUser({ id: 'u1', role: 'student' });
    useSessionStore.getState().setUser(null);
    const state = useSessionStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('clearSession resets auth state and clears loading', () => {
    useSessionStore.getState().setUser({ id: 'u1', role: 'student' });
    useSessionStore.getState().clearSession();
    const state = useSessionStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
  });
});