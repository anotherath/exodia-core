import { UserService } from '../user.service';
import { NonceRepository } from 'src/repositories/nonce/nonce.repository';
import { UserRepository } from 'src/repositories/user/user.repository';
import { connectTestDB, closeTestDB } from 'test/mongo-memory';
import { NonceModel } from 'src/repositories/nonce/nonce.model';
import { UserModel } from 'src/repositories/user/user.model';
import { HexString } from 'src/shared/types/web3.type';
import { ActivateUserValue } from 'src/shared/types/eip712.type';
import * as eip712Util from 'src/shared/utils/eip712.util';
import { BadRequestException } from '@nestjs/common';

// Mock generateNonce
jest.mock('src/shared/utils/web3.util', () => ({
  generateNonce: jest.fn().mockReturnValue('fake_nonce'),
}));

// Mock verifyAndConsumeNonce
jest.mock('src/shared/utils/eip712.util', () => ({
  verifyAndConsumeNonce: jest.fn(),
}));

describe('UserService', () => {
  let service: UserService;
  let nonceRepo: NonceRepository;
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

    nonceRepo = new NonceRepository();
    userRepo = new UserRepository();
    service = new UserService(nonceRepo, userRepo);
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    // clear DB
    await NonceModel.deleteMany({});
    await UserModel.deleteMany({});

    jest.clearAllMocks();
    (eip712Util.verifyAndConsumeNonce as jest.Mock).mockResolvedValue(
      undefined,
    );
  });

  it('should activate user successfully', async () => {
    const result = await service.activeUser(activateData, fakeSignature);

    expect(result).toBe(true);
    // Kiểm tra verifyAndConsumeNonce được gọi đúng params
    expect(eip712Util.verifyAndConsumeNonce).toHaveBeenCalledWith(
      nonceRepo, // nonceRepo passed in
      expect.objectContaining({
        walletAddress,
        nonce: fakeNonce,
        signature: fakeSignature,
        message: activateData, // message phải match với activateData
      }),
    );

    const user = await userRepo.findByWallet(walletAddress);
    expect(user?.isActive).toBe(true);
  });

  it('should return false if verification fails', async () => {
    // Mock verify throw error
    (eip712Util.verifyAndConsumeNonce as jest.Mock).mockRejectedValue(
      new BadRequestException('Invalid signature'),
    );

    const result = await service.activeUser(activateData, fakeSignature);

    expect(result).toBe(false);
    expect(eip712Util.verifyAndConsumeNonce).toHaveBeenCalled();

    // User should not be created or active
    const user = await userRepo.findByWallet(walletAddress);
    expect(user).toBeNull();
  });

  it('should check active user correctly', async () => {
    expect(await service.isActiveUser(walletAddress)).toBe(false);

    await userRepo.upsert(walletAddress, { isActive: true });

    expect(await service.isActiveUser(walletAddress)).toBe(true);

    // case: user tồn tại nhưng isActive = false
    await userRepo.upsert(walletAddress, { isActive: false });
    expect(await service.isActiveUser(walletAddress)).toBe(false);

    // case: user bị soft delete
    await userRepo.softDelete(walletAddress);
    expect(await service.isActiveUser(walletAddress)).toBe(false);
  });

  it('should handle wallet address case-insensitivity in isActiveUser', async () => {
    const upperAddress = walletAddress.toUpperCase() as HexString;
    const lowerAddress = walletAddress.toLowerCase() as HexString;

    await userRepo.upsert(lowerAddress, { isActive: true });

    expect(await service.isActiveUser(upperAddress)).toBe(true);
    expect(await service.isActiveUser(lowerAddress)).toBe(true);
  });
});
