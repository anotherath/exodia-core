import { UserService } from '../user.service';
import { NonceRepository } from 'src/repositories/cache/nonce-cache.repository';
import { UserRepository } from 'src/repositories/user/user.repository';
import { connectTestDB, closeTestDB } from 'test/mongo-memory';
import { UserModel } from 'src/repositories/user/user.model';
import { HexString } from 'src/shared/types/web3.type';
import { ActivateUserValue } from 'src/shared/types/eip712.type';
import * as eip712Util from 'src/shared/utils/eip712.util';

// Mock NonceRepository
jest.mock('src/repositories/cache/nonce-cache.repository');

// Mock verifyTypedDataSignature
jest.mock('src/shared/utils/eip712.util', () => ({
  verifyTypedDataSignature: jest.fn(),
}));

describe('UserService', () => {
  let service: UserService;
  let nonceRepo: jest.Mocked<NonceRepository>;
  let userRepo: UserRepository;

  const walletAddress = '0x1111111111111111111111111111111111111111';
  const fakeNonce = 'fake_nonce';
  const fakeSignature = '0xFAKE_SIGNATURE' as HexString;

  const activateData: ActivateUserValue = {
    walletAddress,
    nonce: fakeNonce,
    timestamp: new Date().toISOString(),
  };

  beforeAll(async () => {
    await connectTestDB();
    nonceRepo = new NonceRepository(null as any) as any;
    userRepo = new UserRepository();
    service = new UserService(nonceRepo, userRepo);
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await UserModel.deleteMany({});
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Default success verify
    (eip712Util.verifyTypedDataSignature as jest.Mock).mockResolvedValue(true);
  });

  it('should activate user successfully', async () => {
    // 1. Giả lập tìm thấy nonce hợp lệ
    nonceRepo.findValid.mockResolvedValue({
      walletAddress: walletAddress.toLowerCase(),
      nonce: fakeNonce,
      expiresAt: new Date(Date.now() + 100000),
    });

    // 2. Gọi service activeUser
    const result = await service.activeUser(activateData, fakeSignature);

    expect(result).toBe(true);
    // Verify signature check
    expect(eip712Util.verifyTypedDataSignature).toHaveBeenCalled();

    // Check user active
    const user = await userRepo.findByWallet(walletAddress);
    expect(user?.isActive).toBe(true);
  });

  it('should return false if nonce not found or invalid', async () => {
    // Giả lập KHÔNG tìm thấy nonce
    nonceRepo.findValid.mockResolvedValue(null);

    const result = await service.activeUser(activateData, fakeSignature);

    expect(result).toBe(false);
    expect(eip712Util.verifyTypedDataSignature).not.toHaveBeenCalled(); // Fail sớm
  });

  it('should return false if nonce does not match', async () => {
    // Giả lập tìm thấy nonce NHƯNG giá trị khác
    nonceRepo.findValid.mockResolvedValue({
      walletAddress: walletAddress.toLowerCase(),
      nonce: 'different_nonce',
      expiresAt: new Date(Date.now() + 100000),
    });

    const result = await service.activeUser(
      {
        ...activateData,
        nonce: 'wrong_nonce',
      },
      fakeSignature,
    );

    expect(result).toBe(false);
    expect(eip712Util.verifyTypedDataSignature).not.toHaveBeenCalled();
  });

  it('should return false if signature verification fails', async () => {
    nonceRepo.findValid.mockResolvedValue({
      walletAddress: walletAddress.toLowerCase(),
      nonce: fakeNonce,
      expiresAt: new Date(Date.now() + 100000),
    });
    (eip712Util.verifyTypedDataSignature as jest.Mock).mockResolvedValue(false);

    const result = await service.activeUser(activateData, fakeSignature);

    expect(result).toBe(false);
    expect(eip712Util.verifyTypedDataSignature).toHaveBeenCalled();
  });

  it('should check active user correctly', async () => {
    expect(await service.isActiveUser(walletAddress)).toBe(false);
    await userRepo.upsert(walletAddress, { isActive: true });
    expect(await service.isActiveUser(walletAddress)).toBe(true);
  });
});
