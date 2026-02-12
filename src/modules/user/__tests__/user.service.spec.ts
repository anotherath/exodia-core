import { UserService } from '../user.service';
import { NonceRepository } from 'src/repositories/nonce/nonce.repository';
import { UserRepository } from 'src/repositories/user/user.repository';
import { connectTestDB, closeTestDB } from 'test/mongo-memory';
import { NonceModel } from 'src/repositories/nonce/nonce.model';
import { UserModel } from 'src/repositories/user/user.model';
import { HexString } from 'src/shared/types/web3.type';
import { ActivateUserValue } from 'src/shared/types/eip712.type';
import * as eip712Util from 'src/shared/utils/eip712.util';

// Mock generateNonce (mặc dù có thể dùng real DB, nhưng mock giúp kiểm soát tốt hơn)
jest.mock('src/shared/utils/web3.util', () => ({
  generateNonce: jest.fn().mockReturnValue('fake_nonce'),
}));

// Mock verifyTypedDataSignature
jest.mock('src/shared/utils/eip712.util', () => ({
  verifyTypedDataSignature: jest.fn(),
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
    await NonceModel.deleteMany({});
    await UserModel.deleteMany({});
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Default success verify
    (eip712Util.verifyTypedDataSignature as jest.Mock).mockResolvedValue(true);
  });

  it('should activate user successfully', async () => {
    // 1. Tạo nonce trong DB
    await nonceRepo.upsert(walletAddress);

    // 2. Gọi service activeUser
    const result = await service.activeUser(activateData, fakeSignature);

    expect(result).toBe(true);
    // Verify signature check
    expect(eip712Util.verifyTypedDataSignature).toHaveBeenCalled();

    // Check nonce deleted
    const nonceInfo = await nonceRepo.findValid(walletAddress);
    expect(nonceInfo).toBeNull();

    // Check user active
    const user = await userRepo.findByWallet(walletAddress);
    expect(user?.isActive).toBe(true);
  });

  it('should return false if nonce not found or invalid', async () => {
    // Không tạo nonce -> findValid trả về null
    const result = await service.activeUser(activateData, fakeSignature);

    expect(result).toBe(false);
    expect(eip712Util.verifyTypedDataSignature).not.toHaveBeenCalled(); // Fail sớm
  });

  it('should return false if nonce does not match', async () => {
    // Tạo nonce khác trong DB
    await nonceRepo.upsert(walletAddress);

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
    await nonceRepo.upsert(walletAddress);
    (eip712Util.verifyTypedDataSignature as jest.Mock).mockResolvedValue(false);

    const result = await service.activeUser(activateData, fakeSignature);

    expect(result).toBe(false);
    expect(eip712Util.verifyTypedDataSignature).toHaveBeenCalled();

    // Nonce still valid (or maybe depending on logic? Service throws/catches error, so nonce deletion is skipped)
    // Actually in service: invalid signature throws Exception, caught, returns false.
    // Nonce deletion happens ONLY on success.
    const nonceInfo = await nonceRepo.findValid(walletAddress);
    expect(nonceInfo).not.toBeNull();
  });

  it('should check active user correctly', async () => {
    expect(await service.isActiveUser(walletAddress)).toBe(false);
    await userRepo.upsert(walletAddress, { isActive: true });
    expect(await service.isActiveUser(walletAddress)).toBe(true);
  });
});
