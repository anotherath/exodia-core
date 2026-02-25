import { UserService } from '../user.service';
import { NonceService } from 'src/modules/nonce/nonce.service';
import { UserRepository } from 'src/repositories/user/user.repository';
import { connectTestDB, closeTestDB } from 'test/mongo-memory';
import { UserModel } from 'src/repositories/user/user.model';
import { HexString } from 'src/shared/types/web3.type';
import { ActivateUserValue } from 'src/shared/types/eip712.type';
import { UserValidationService } from '../user-validation.service';

describe('UserService', () => {
  let service: UserService;
  let nonceService: jest.Mocked<NonceService>;
  let userRepo: UserRepository;
  let userValidation: UserValidationService;

  const walletAddress = '0x1111111111111111111111111111111111111111';
  const fakeNonce = 'fake_nonce';
  const fakeSignature =
    '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef01' as HexString;

  const activateData: ActivateUserValue = {
    walletAddress,
    nonce: fakeNonce,
    timestamp: new Date().toISOString(),
  };

  beforeAll(async () => {
    await connectTestDB();
    nonceService = {
      verifyAndConsume: jest.fn(),
    } as any;
    userRepo = new UserRepository();
    userValidation = new UserValidationService();
    service = new UserService(nonceService, userRepo, userValidation);
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await UserModel.deleteMany({});
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should activate user successfully', async () => {
    // 1. Giả lập verifyAndConsume thành công (không throw lỗi)
    nonceService.verifyAndConsume.mockResolvedValue(undefined);

    // 2. Gọi service activeUser
    const result = await service.activeUser(activateData, fakeSignature);

    expect(result).toBe(true);
    // Verify verifyAndConsume was called with correct params
    expect(nonceService.verifyAndConsume).toHaveBeenCalledWith({
      walletAddress,
      nonce: activateData.nonce,
      signature: fakeSignature,
      types: expect.any(Object),
      primaryType: 'ActivateUser',
      message: expect.any(Object),
    });

    // Check user active
    const user = await userRepo.findByWallet(walletAddress);
    expect(user?.isActive).toBe(true);
  });

  it('should return false if verification fails', async () => {
    // Giả lập verifyAndConsume throw lỗi
    nonceService.verifyAndConsume.mockRejectedValue(
      new Error('Invalid signature'),
    );

    const result = await service.activeUser(activateData, fakeSignature);

    expect(result).toBe(false);
    expect(nonceService.verifyAndConsume).toHaveBeenCalled();
  });

  it('should check active user correctly', async () => {
    expect(await service.isActiveUser(walletAddress)).toBe(false);
    await userRepo.upsert(walletAddress, { isActive: true });
    expect(await service.isActiveUser(walletAddress)).toBe(true);
  });
});
