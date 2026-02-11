import { UserService } from '../user.service';
import { NonceRepository } from 'src/repositories/nonce/nonce.repository';
import { UserRepository } from 'src/repositories/user/user.repository';
import { connectTestDB, closeTestDB } from 'test/mongo-memory';
import { NonceModel } from 'src/repositories/nonce/nonce.model';
import { UserModel } from 'src/repositories/user/user.model';
import { ISignKeyInfo, HexString } from 'src/shared/types/web3.type';

jest.mock('src/shared/utils/web3.util', () => {
  const original = jest.requireActual('src/shared/utils/web3.util');
  return {
    ...original,
    generateNonce: jest.fn(),
    verifySignature: jest.fn(),
  };
});

import { generateNonce, verifySignature } from 'src/shared/utils/web3.util';

describe('UserService', () => {
  let service: UserService;
  let nonceRepo: NonceRepository;
  let userRepo: UserRepository;

  const walletAddress = '0x1111111111111111111111111111111111111111';
  const walletAddress1 = '0x1111111111111111111111111111111111111112';
  const walletAddress2 = '0x1111111111111111111111111111111111111113';
  const fakeNonce = '1234567890abcdef';
  const fakeSignature = '0xFAKE_SIGNATURE';
  const fakeMessage = `
exodia.io wants you to sign in with your Ethereum account:
${walletAddress}

I accept the Exodia Terms of Service.

URI: https://exodia.io
Version: 1
Chain ID: 1
Nonce: ${fakeNonce}
Issued At: 2021-09-30T16:25:24Z
`;

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

    // fake nonce sinh ra từ repo
    (generateNonce as jest.Mock).mockReturnValue(fakeNonce);
  });

  it('should activate user successfully', async () => {
    // tạo nonce (nonce = fakeNonce)
    const nonceInfo = await nonceRepo.upsert(walletAddress);
    expect(nonceInfo.nonce).toBe(fakeNonce);

    (verifySignature as jest.Mock).mockResolvedValue(true);

    const signKeyInfo: ISignKeyInfo = {
      walletAddress,
      message: fakeMessage,
      signature: fakeSignature,
    };

    const result = await service.activeUser(signKeyInfo);

    expect(result).toBe(true);

    const user = await userRepo.findByWallet(walletAddress);
    expect(user?.isActive).toBe(true);
    expect(verifySignature).toHaveBeenCalledWith(signKeyInfo);

    const nonceAfter = await nonceRepo.findValid(walletAddress);
    expect(nonceAfter).toBeNull();
  });

  it('should fail if nonce not exists', async () => {
    (verifySignature as jest.Mock).mockResolvedValue(true);

    const result = await service.activeUser({
      walletAddress,
      message: fakeMessage,
      signature: fakeSignature,
    });

    expect(result).toBe(false);
    expect(verifySignature).not.toHaveBeenCalled();
  });

  it('should fail if message does not match nonce', async () => {
    await nonceRepo.upsert(walletAddress);

    (verifySignature as jest.Mock).mockResolvedValue(true);

    const wrongMessage = fakeMessage.replace(fakeNonce, 'WRONG_NONCE');

    const result = await service.activeUser({
      walletAddress,
      message: wrongMessage,
      signature: fakeSignature,
    });

    expect(result).toBe(false);
    expect(verifySignature).not.toHaveBeenCalled();
  });

  it('should fail if signature invalid', async () => {
    await nonceRepo.upsert(walletAddress2);

    (verifySignature as jest.Mock).mockResolvedValue(false);

    const result = await service.activeUser({
      walletAddress: walletAddress2,
      message: fakeMessage,
      signature: fakeSignature,
    });

    expect(result).toBe(false);

    const user = await userRepo.findByWallet(walletAddress2);
    expect(user).toBeNull();
  });

  it('should fail if activating twice (nonce deleted after first success)', async () => {
    await nonceRepo.upsert(walletAddress);
    (verifySignature as jest.Mock).mockResolvedValue(true);

    const signKeyInfo: ISignKeyInfo = {
      walletAddress,
      message: fakeMessage,
      signature: fakeSignature,
    };

    // First time: success
    const firstResult = await service.activeUser(signKeyInfo);
    expect(firstResult).toBe(true);

    // Second time: fail because nonce was deleted
    const secondResult = await service.activeUser(signKeyInfo);
    expect(secondResult).toBe(false);
  });

  it('should check active user correctly', async () => {
    expect(await service.isActiveUser(walletAddress1)).toBe(false);

    await userRepo.upsert(walletAddress1, { isActive: true });

    expect(await service.isActiveUser(walletAddress1)).toBe(true);

    // case: user tồn tại nhưng isActive = false
    await userRepo.upsert(walletAddress1, { isActive: false });
    expect(await service.isActiveUser(walletAddress1)).toBe(false);

    // case: user bị soft delete
    await userRepo.softDelete(walletAddress1);
    expect(await service.isActiveUser(walletAddress1)).toBe(false);
  });

  it('should handle wallet address case-insensitivity', async () => {
    const upperAddress = walletAddress.toUpperCase() as HexString;
    const lowerAddress = walletAddress.toLowerCase() as HexString;

    await nonceRepo.upsert(lowerAddress);
    (verifySignature as jest.Mock).mockResolvedValue(true);

    const result = await service.activeUser({
      walletAddress: upperAddress,
      message: fakeMessage,
      signature: fakeSignature,
    });

    expect(result).toBe(true);
    expect(await service.isActiveUser(lowerAddress)).toBe(true);
    expect(await service.isActiveUser(upperAddress)).toBe(true);
  });
});
