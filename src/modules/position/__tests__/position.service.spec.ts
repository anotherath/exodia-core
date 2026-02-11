import { PositionService } from '../position.service';
import { PositionRepository } from 'src/repositories/position/position.repository';
import { NonceRepository } from 'src/repositories/nonce/nonce.repository';
import { connectTestDB, closeTestDB } from 'test/mongo-memory';
import { PositionModel } from 'src/repositories/position/position.model';
import { NonceModel } from 'src/repositories/nonce/nonce.model';
import { Position } from 'src/shared/types/position.type';
import * as eip712Util from 'src/shared/utils/eip712.util';

// Mock verifyTypedDataSignature
jest.mock('src/shared/utils/eip712.util', () => ({
  verifyTypedDataSignature: jest.fn(),
}));

describe('PositionService', () => {
  let service: PositionService;
  let repo: PositionRepository;
  let nonceRepo: NonceRepository;

  const walletAddress = '0x1111111111111111111111111111111111111111';
  const fakeNonce = 'fake_nonce';
  const mockTypedData = {
    walletAddress,
    nonce: fakeNonce,
  } as any;
  const mockSignature = '0xFAKE_SIGNATURE' as any;

  const mockPosition: Position = {
    walletAddress,
    symbol: 'BTC-USDT',
    side: 'long',
    type: 'market',
    status: 'open',
    qty: 1000,
    leverage: 10,
    pnl: 0,
  };

  beforeAll(async () => {
    await connectTestDB();
    repo = new PositionRepository();
    nonceRepo = new NonceRepository();
    service = new PositionService(repo, nonceRepo);
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await PositionModel.deleteMany({});
    await NonceModel.deleteMany({});
    jest.clearAllMocks();

    // Setup valid nonce in DB
    await NonceModel.create({
      walletAddress: walletAddress.toLowerCase(),
      nonce: fakeNonce,
      expiresAt: new Date(Date.now() + 60000), // 1 min from now
    });

    // Mock verify success
    (eip712Util.verifyTypedDataSignature as jest.Mock).mockResolvedValue(true);
  });

  describe('openMarket', () => {
    it('should create an open position and cleanup nonce', async () => {
      const result = await service.openMarket(
        mockPosition,
        mockTypedData,
        mockSignature,
      );

      expect(result.status).toBe('open');
      expect(result.walletAddress).toBe(walletAddress);

      // Verify signature checked
      expect(eip712Util.verifyTypedDataSignature).toHaveBeenCalled();

      // Verify nonce deleted
      const nonce = await NonceModel.findOne({
        walletAddress: walletAddress.toLowerCase(),
      });
      expect(nonce).toBeNull();
    });

    it('should throw error if nonce invalid (wrong nonce)', async () => {
      const wrongNonceData = { ...mockTypedData, nonce: 'WRONG' };

      await expect(
        service.openMarket(mockPosition, wrongNonceData, mockSignature),
      ).rejects.toThrow('Nonce không hợp lệ hoặc đã hết hạn');

      // Verify signature NOT called (fail early)
      expect(eip712Util.verifyTypedDataSignature).not.toHaveBeenCalled();
    });

    it('should throw error if signature invalid', async () => {
      (eip712Util.verifyTypedDataSignature as jest.Mock).mockResolvedValue(
        false,
      );

      await expect(
        service.openMarket(mockPosition, mockTypedData, mockSignature),
      ).rejects.toThrow('Chữ ký không hợp lệ');

      // Nonce should NOT be deleted (so client can retry with correct signature? or should we ban nonce? Usually keep valid for retry until expiry)
      const nonce = await NonceModel.findOne({
        walletAddress: walletAddress.toLowerCase(),
      });
      expect(nonce).not.toBeNull();
    });
  });

  // Basic tests for other methods (assuming reuse of private helper)
  describe('openLimit', () => {
    it('should create a pending position', async () => {
      const result = await service.openLimit(
        mockPosition,
        mockTypedData,
        mockSignature,
      );
      expect(result.status).toBe('pending');
    });
  });

  describe('updatePending', () => {
    it('should update a pending order', async () => {
      const pos = await PositionModel.create({
        ...mockPosition,
        status: 'pending',
      });
      const updateData = { qty: 2000 };

      const result = await service.updatePending(
        pos._id.toString(),
        updateData,
        mockTypedData,
        mockSignature,
      );
      expect(result!.qty).toBe(2000);
    });
  });

  describe('updateOpen', () => {
    it('should update an open position', async () => {
      const pos = await PositionModel.create({
        ...mockPosition,
        status: 'open',
      });
      const updateData = { leverage: 20 };

      const result = await service.updateOpen(
        pos._id.toString(),
        updateData,
        mockTypedData,
        mockSignature,
      );
      expect(result!.leverage).toBe(20);
    });
  });

  describe('close', () => {
    it('should close position', async () => {
      const pos = await PositionModel.create({
        ...mockPosition,
        status: 'open',
      });
      const result = await service.close(
        pos._id.toString(),
        100,
        mockTypedData,
        mockSignature,
      );
      expect(result!.status).toBe('closed');
    });
  });
});
