/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { ExploreListingCard, type ExploreListing } from './explore-listing-card';

jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: { alt: string }) => <img alt={props.alt} />,
}));
jest.mock('@/components/ui/save-button', () => ({ SaveButton: () => <button>save</button> }));

const base: ExploreListing = {
  id: '1',
  title: 'Sunrise Hostel',
  price: 6500,
  location: 'Near Gate A',
  slug: 'sunrise-hostel',
  area: 'near-gate-a',
};

describe('ExploreListingCard ratings', () => {
  it('shows the average and the number of reviews behind it', () => {
    render(<ExploreListingCard item={{ ...base, rating: 4.3, review_count: 3 }} />);
    expect(screen.getByText('4.3')).toBeTruthy();
    expect(screen.getByText('(3)')).toBeTruthy();
    expect(screen.getByText(/from 3 reviews/)).toBeTruthy();
  });

  it('uses the singular for one review', () => {
    render(<ExploreListingCard item={{ ...base, rating: 5, review_count: 1 }} />);
    expect(screen.getByText(/from 1 review$/)).toBeTruthy();
  });

  it('shows no rating without published reviews, even if a stale rating value is present', () => {
    render(<ExploreListingCard item={{ ...base, rating: 4.8, review_count: 0 }} />);
    expect(screen.queryByText('4.8')).toBeNull();
    expect(screen.queryByText(/review/)).toBeNull();
  });

  it('formats the area name from a slug', () => {
    render(<ExploreListingCard item={base} />);
    expect(screen.getByText(/Near Gate A/)).toBeTruthy();
  });
});
