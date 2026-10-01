import { revalidatePath } from 'next/cache';
import { bnbApi } from '@/lib/api/bnb';
import { listingsApi } from '@/lib/api/listings';
import {
  createBnbListingAction,
  deleteBnbListingAction,
  toggleBnbActiveAction,
  updateBnbListingAction,
} from '../bnb';

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

jest.mock('@/lib/api/bnb', () => ({
  bnbApi: {
    createServer: jest.fn(),
    updateServer: jest.fn(),
  },
}));

jest.mock('@/lib/api/listings', () => ({
  listingsApi: {
    toggleActiveServer: jest.fn(),
    deleteServer: jest.fn(),
  },
}));

const mockedRevalidatePath = jest.mocked(revalidatePath);
const mockedBnbApi = jest.mocked(bnbApi);
const mockedListingsApi = jest.mocked(listingsApi);

describe('BnB action cache invalidation', () => {
  const listingId = 'bnb-listing-id';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('invalidates the BnB feed and new detail page after creation', async () => {
    mockedBnbApi.createServer.mockResolvedValue({ id: listingId } as never);

    const result = await createBnbListingAction({} as never);

    expect(result.success).toBe(true);
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/bnb');
    expect(mockedRevalidatePath).toHaveBeenCalledWith(`/bnb/${listingId}`);
  });

  it('invalidates the BnB feed and affected detail page after update', async () => {
    mockedBnbApi.updateServer.mockResolvedValue(
      { id: listingId, slug: 'bnb-slug' } as never,
    );

    const result = await updateBnbListingAction(listingId, {} as never);

    expect(result.success).toBe(true);
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/bnb');
    expect(mockedRevalidatePath).toHaveBeenCalledWith(`/bnb/${listingId}`);
    expect(mockedRevalidatePath).toHaveBeenCalledWith(`/listing/${listingId}`);
  });

  it('invalidates the BnB feed and affected detail page after pause or publish', async () => {
    mockedListingsApi.toggleActiveServer.mockResolvedValue({} as never);

    const result = await toggleBnbActiveAction(listingId, false);

    expect(result.success).toBe(true);
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/bnb');
    expect(mockedRevalidatePath).toHaveBeenCalledWith(`/bnb/${listingId}`);
  });

  it('invalidates the BnB feed and affected detail page after deletion', async () => {
    mockedListingsApi.deleteServer.mockResolvedValue({} as never);

    const result = await deleteBnbListingAction(listingId);

    expect(result.success).toBe(true);
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/bnb');
    expect(mockedRevalidatePath).toHaveBeenCalledWith(`/bnb/${listingId}`);
  });

  it('does not invalidate public BnB pages when mutations fail', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedBnbApi.createServer.mockRejectedValue(new Error('create failed'));
    mockedBnbApi.updateServer.mockRejectedValue(new Error('update failed'));
    mockedListingsApi.toggleActiveServer.mockRejectedValue(
      new Error('toggle failed'),
    );
    mockedListingsApi.deleteServer.mockRejectedValue(new Error('delete failed'));

    const results = await Promise.all([
      createBnbListingAction({} as never),
      updateBnbListingAction(listingId, {} as never),
      toggleBnbActiveAction(listingId, false),
      deleteBnbListingAction(listingId),
    ]);

    expect(results.every((result) => !result.success)).toBe(true);
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
