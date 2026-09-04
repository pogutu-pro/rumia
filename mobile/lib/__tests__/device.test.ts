import { getAnonymousDeviceHash } from '../device';
import { secureStorage } from '../storage/secure-store';
import * as Crypto from 'expo-crypto';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
  randomUUID: jest.fn(() => 'mock-uuid-1234'),
  digestStringAsync: jest.fn(async (_algo: string, value: string) => `sha256:${value}`),
}));

jest.mock('../storage/secure-store', () => ({
  secureStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

const mockedSecureStorage = secureStorage as jest.Mocked<typeof secureStorage>;
const mockedCrypto = Crypto as jest.Mocked<typeof Crypto>;

describe('getAnonymousDeviceHash', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a cached hash for an existing install', async () => {
    mockedSecureStorage.getItem.mockResolvedValueOnce('existing-id');
    const hash = await getAnonymousDeviceHash();
    expect(mockedSecureStorage.getItem).toHaveBeenCalledWith('rumia_anonymous_device_id');
    expect(mockedSecureStorage.setItem).not.toHaveBeenCalled();
    expect(Crypto.digestStringAsync).toHaveBeenCalledWith('SHA256', 'existing-id');
    expect(hash).toBe('sha256:existing-id');
  });

  it('creates, persists, and hashes an id on first run', async () => {
    mockedSecureStorage.getItem.mockResolvedValueOnce(null);
    const hash = await getAnonymousDeviceHash();
    expect(mockedCrypto.randomUUID).toHaveBeenCalled();
    expect(mockedSecureStorage.setItem).toHaveBeenCalledWith(
      'rumia_anonymous_device_id',
      'mock-uuid-1234',
    );
    expect(hash).toBe('sha256:mock-uuid-1234');
  });

  it('is stable across calls for the same install', async () => {
    mockedSecureStorage.getItem.mockResolvedValue('stable-id');
    const first = await getAnonymousDeviceHash();
    const second = await getAnonymousDeviceHash();
    expect(first).toBe(second);
  });
});