import { UserService } from '../user.service';
import { NonceRepository } from 'src/repositories/nonce/nonce.repository';
import { UserRepository } from 'src/repositories/user/user.repository';
import { connectTestDB, closeTestDB } from 'test/mongo-memory';

// ✅ MOCK PHẢI ĐẶT Ở ĐẦU FILE
jest.mock('src/shared/utils/web3.util', () => ({
  generateNonce: jest.fn(),
  verifySignature: jest.fn(),
}));

import { generateNonce, verifySignature } from 'src/shared/utils/web3.util';

describe('UserService', () => {
  let service: UserService;
  let nonceRepo: NonceRepository;
  let userRepo: UserRepository;

  const walletAddress = '0x1111111111111111111111111111111111111111';
  const walletAddress1 = '0x1111111111111111111111111111111111111112';
  const walletAddress2 = '0x1111111111111111111111111111111111111113';
  const fakeNonce = 'FAKE_NONCE_123';
  const fakeSignature = 'FAKE_SIGNATURE';

  beforeAll(async () => {
    await connectTestDB();

    nonceRepo = new NonceRepository();
    userRepo = new UserRepository();
    service = new UserService(nonceRepo, userRepo);
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    // clear DB
    if ((nonceRepo as any).model) {
      await (nonceRepo as any).model.deleteMany({});
    }
    if ((userRepo as any).model) {
      await (userRepo as any).model.deleteMany({});
    }

    jest.clearAllMocks();

    // fake nonce sinh ra từ repo
    (generateNonce as jest.Mock).mockReturnValue(fakeNonce);
  });

  it('should activate user successfully', async () => {
    // tạo nonce (nonce = fakeNonce)
    const nonceInfo = await nonceRepo.upsert(walletAddress);
    expect(nonceInfo.nonce).toBe(fakeNonce);

    (verifySignature as jest.Mock).mockResolvedValue(true);

    const result = await service.activeUser({
      walletAddress,
      message: fakeNonce, // MVP: message = nonce
      signature: fakeSignature,
    } as any);

    expect(result).toBe(true);

    const user = await userRepo.findByWallet(walletAddress);
    expect(user?.isActive).toBe(true);

    const nonceAfter = await nonceRepo.findValid(walletAddress);
    expect(nonceAfter).toBeNull();
  });

  it('should fail if nonce not exists', async () => {
    (verifySignature as jest.Mock).mockResolvedValue(true);

    const result = await service.activeUser({
      walletAddress,
      message: fakeNonce,
      signature: fakeSignature,
    } as any);

    expect(result).toBe(false);
    expect(verifySignature).not.toHaveBeenCalled();
  });

  it('should fail if message does not match nonce', async () => {
    await nonceRepo.upsert(walletAddress);

    (verifySignature as jest.Mock).mockResolvedValue(true);

    const result = await service.activeUser({
      walletAddress,
      message: 'WRONG_NONCE',
      signature: fakeSignature,
    } as any);

    expect(result).toBe(false);
    expect(verifySignature).not.toHaveBeenCalled();
  });

  it('should fail if signature invalid', async () => {
    await nonceRepo.upsert(walletAddress2);

    (verifySignature as jest.Mock).mockResolvedValue(false);

    const result = await service.activeUser({
      walletAddress: walletAddress2,
      message: fakeNonce,
      signature: fakeSignature,
    } as any);

    expect(result).toBe(false);

    const user = await userRepo.findByWallet(walletAddress2);
    expect(user).toBeNull();
  });

  it('should check active user correctly', async () => {
    expect(await service.isActiveUser(walletAddress1)).toBe(false);

    await userRepo.upsert(walletAddress1, { isActive: true });

    expect(await service.isActiveUser(walletAddress1)).toBe(true);
  });
});
