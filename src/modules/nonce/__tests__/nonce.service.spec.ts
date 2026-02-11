import { NonceService } from '../nonce.service';
import { NonceRepository } from 'src/repositories/nonce/nonce.repository';
import { connectTestDB, closeTestDB } from 'test/mongo-memory';
import { NonceModel } from 'src/repositories/nonce/nonce.model';
import { generateNonce } from 'src/shared/utils/web3.util';

jest.mock('src/shared/utils/web3.util', () => ({
  generateNonce: jest.fn(),
}));

describe('NonceService', () => {
  let service: NonceService;
  let nonceRepo: NonceRepository;

  const walletAddress = '0x1111111111111111111111111111111111111111';
  const fakeNonce = '1234567890abcdef';

  beforeAll(async () => {
    await connectTestDB();
    nonceRepo = new NonceRepository();
    service = new NonceService(nonceRepo);
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await NonceModel.deleteMany({});
    jest.clearAllMocks();
    (generateNonce as jest.Mock).mockReturnValue(fakeNonce);
  });

  it('should return existing valid nonce if found', async () => {
    // Manually create a nonce
    await nonceRepo.upsert(walletAddress);
    jest.clearAllMocks();

    // Mock generateNonce to return a DIFFERENT value to prove it's NOT called during getNonce
    const newFakeNonce = 'different_nonce';
    (generateNonce as jest.Mock).mockReturnValue(newFakeNonce);

    const result = await service.getNonce(walletAddress);

    expect(result).toBe(fakeNonce); // Should be the original one from upsert
    expect(generateNonce).not.toHaveBeenCalled();
  });

  it('should generate and return a new nonce if no valid nonce exists', async () => {
    const result = await service.getNonce(walletAddress);

    expect(result).toBe(fakeNonce);
    expect(generateNonce).toHaveBeenCalledTimes(1);

    const savedNonce = await nonceRepo.findValid(walletAddress);
    expect(savedNonce?.nonce).toBe(fakeNonce);
  });

  it('should generate a new nonce if the existing one is expired', async () => {
    // Manually create an expired nonce
    const expiredNonceInfo = {
      walletAddress: walletAddress.toLowerCase(),
      nonce: 'expired_nonce',
      expiresAt: new Date(Date.now() - 1000), // 1 second ago
    };
    await NonceModel.create(expiredNonceInfo);

    (generateNonce as jest.Mock).mockReturnValue(fakeNonce);

    const result = await service.getNonce(walletAddress);

    expect(result).toBe(fakeNonce);
    expect(generateNonce).toHaveBeenCalledTimes(1);
  });
});
