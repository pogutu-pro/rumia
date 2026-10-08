/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { CheckLookup } from '../check-lookup';

const mockLookup = jest.fn();
jest.mock('@/lib/api/public', () => ({
  publicApi: {
    lookupVerifyCandidates: (q: string) => mockLookup(q),
  },
}));

describe('CheckLookup', () => {
  beforeEach(() => jest.clearAllMocks());

  it('asks for at least three characters before checking', () => {
    render(<CheckLookup />);
    const input = screen.getByLabelText('Phone number, M-Pesa detail or hostel name');
    fireEvent.submit(screen.getByRole('button', { name: 'Check' }) as HTMLButtonElement);
    expect(mockLookup).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '07' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Check' }));
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it('checks and shows verified candidates with a link to the place', async () => {
    mockLookup.mockResolvedValue([
      {
        id: 'p1',
        title: 'Urban Suites',
        slug: 'urban-suites',
        landlord_phone: '0728123456',
        mpesa_details: 'Paybill 247247',
        verified: true,
        area: 'Dekut',
        county: 'Nyeri',
      },
    ]);
    render(<CheckLookup />);
    fireEvent.change(screen.getByLabelText('Phone number, M-Pesa detail or hostel name'), {
      target: { value: '0728 123 456' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Check' }));

    expect(await screen.findByRole('heading', { name: 'Urban Suites' })).toBeInTheDocument();
    expect(screen.getByText(/Verified by Rumia/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View place' })).toHaveAttribute('href', '/p/urban-suites');
  });

  it('explains what to do when nothing matches', async () => {
    mockLookup.mockResolvedValue([]);
    render(<CheckLookup />);
    fireEvent.change(screen.getByLabelText('Phone number, M-Pesa detail or hostel name'), {
      target: { value: 'Suspicious Hostel' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Check' }));

    expect(await screen.findByRole('heading', { name: 'Nothing on file for that' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'report anything suspicious' })).toHaveAttribute('href', '/verify/report');
  });
});