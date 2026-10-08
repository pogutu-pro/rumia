/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { SignInSheet } from '../sign-in-sheet';

const mockSignInWithGoogle = jest.fn().mockResolvedValue({ data: {}, error: null });
jest.mock('@/lib/supabase/auth', () => ({
  signInWithGoogle: (...args: unknown[]) => mockSignInWithGoogle(...(args as [string | undefined])),
}));

// Radix portals need pointer support jsdom lacks; render the dialog inline instead.
jest.mock('@radix-ui/react-dialog', () => {
  const ReactMock = require('react') as typeof import('react');
  const Root = ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <>{children}</> : null;
  const Portal = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  const Overlay = () => <div data-testid="overlay" />;
  const Content = ({ children, ...rest }: { children: React.ReactNode }) => (
    <div data-testid="content" {...rest}>{children}</div>
  );
  const Title = ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  );
  const Description = ({ children }: { children?: React.ReactNode }) => <p>{children}</p>;
  const Close = ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  );
  return { Root, Portal, Overlay, Content, Title, Description, Close, __esModule: true };
});

describe('SignInSheet', () => {
  beforeEach(() => jest.clearAllMocks());

  const renderSheet = (props: Partial<React.ComponentProps<typeof SignInSheet>> = {}) =>
    render(
      <SignInSheet
        open
        onOpenChange={jest.fn()}
        title="Keep your saved places on any phone"
        next="/saved"
        {...props}
      />,
    );

  it('renders the reason as the title and a Google option', () => {
    renderSheet();
    expect(screen.getByRole('heading', { name: 'Keep your saved places on any phone' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
  });

  it('renders nothing while closed', () => {
    renderSheet({ open: false });
    expect(screen.queryByText('Keep your saved places on any phone')).not.toBeInTheDocument();
  });

  it('returns to the intended page after signing in', () => {
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(mockSignInWithGoogle).toHaveBeenCalledWith('/saved');
  });

  it('defaults the return page to /account', () => {
    renderSheet({ next: undefined });
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(mockSignInWithGoogle).toHaveBeenCalledWith('/account');
  });
});