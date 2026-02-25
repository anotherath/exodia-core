import { WalletRepository } from '../wallet.repository';
import { WalletModel } from '../wallet.model';
import { roundWithPrecision } from 'src/shared/utils/math.util';
import { BALANCE_CONFIG } from 'src/config/balance.config';

// Mock WalletModel
jest.mock('../wallet.model');

// ─── Helper ──────────────────────────────────────
const round = (v: number) =>
  roundWithPrecision(v, BALANCE_CONFIG.PRECISION, false);

const mockLeanReturn = (value: unknown) => ({
  lean: jest.fn().mockResolvedValue(value),
});

const mockChainReturn = (value: unknown) => ({
  sort: jest.fn().mockReturnValue({
    skip: jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(value),
      }),
    }),
  }),
});

describe('WalletRepository', () => {
  let repo: WalletRepository;

  const walletAddress = '0xabc123';
  const chainId = 1;
  const mockWallet = {
    walletAddress,
    chainId,
    balance: 1000,
    tradeBalance: 500,
    totalDeposited: 1500,
    totalWithdrawn: 0,
  };

  beforeEach(() => {
    repo = new WalletRepository();
    jest.clearAllMocks();
  });

  // ────────────────────────────────────────
  // QUERY – find
  // ────────────────────────────────────────
  describe('find', () => {
    it('should return wallet by address and chainId', async () => {
      (WalletModel.findOne as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(mockWallet));

      const result = await repo.find('0xABC123', chainId);

      expect(WalletModel.findOne).toHaveBeenCalledWith({
        walletAddress: '0xabc123',
        chainId,
      });
      expect(result).toEqual(mockWallet);
    });

    it('should return null when wallet not found', async () => {
      (WalletModel.findOne as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      const result = await repo.find('0xunknown', chainId);

      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────
  // QUERY – findById
  // ────────────────────────────────────────
  describe('findById', () => {
    it('should return wallet by MongoDB _id', async () => {
      (WalletModel.findById as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(mockWallet));

      const result = await repo.findById('64a1b2c3d4e5f6a7b8c9d0e1');

      expect(WalletModel.findById).toHaveBeenCalledWith(
        '64a1b2c3d4e5f6a7b8c9d0e1',
      );
      expect(result).toEqual(mockWallet);
    });

    it('should return null when id does not exist', async () => {
      (WalletModel.findById as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────
  // QUERY – findAll
  // ────────────────────────────────────────
  describe('findAll', () => {
    it('should return paginated results with default params', async () => {
      const wallets = [mockWallet];
      (WalletModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockChainReturn(wallets));
      (WalletModel.countDocuments as jest.Mock) = jest
        .fn()
        .mockResolvedValue(1);

      const result = await repo.findAll();

      expect(WalletModel.find).toHaveBeenCalledWith({});
      expect(WalletModel.countDocuments).toHaveBeenCalledWith({});
      expect(result).toEqual({ data: wallets, total: 1, page: 1, limit: 20 });
    });

    it('should apply walletAddress filter (lowercased)', async () => {
      (WalletModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockChainReturn([]));
      (WalletModel.countDocuments as jest.Mock) = jest
        .fn()
        .mockResolvedValue(0);

      await repo.findAll({ walletAddress: '0xUPPER' });

      expect(WalletModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ walletAddress: '0xupper' }),
      );
    });

    it('should apply chainId filter', async () => {
      (WalletModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockChainReturn([]));
      (WalletModel.countDocuments as jest.Mock) = jest
        .fn()
        .mockResolvedValue(0);

      await repo.findAll({ chainId: 56 });

      expect(WalletModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ chainId: 56 }),
      );
    });

    it('should apply minBalance and maxBalance filters', async () => {
      (WalletModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockChainReturn([]));
      (WalletModel.countDocuments as jest.Mock) = jest
        .fn()
        .mockResolvedValue(0);

      await repo.findAll({ minBalance: 100, maxBalance: 5000 });

      expect(WalletModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          balance: { $gte: 100, $lte: 5000 },
        }),
      );
    });

    it('should apply only minBalance when maxBalance is absent', async () => {
      (WalletModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockChainReturn([]));
      (WalletModel.countDocuments as jest.Mock) = jest
        .fn()
        .mockResolvedValue(0);

      await repo.findAll({ minBalance: 50 });

      expect(WalletModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          balance: { $gte: 50 },
        }),
      );
    });

    it('should calculate correct skip for page 3 with limit 10', async () => {
      const mockSort = jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      (WalletModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue({ sort: mockSort });
      (WalletModel.countDocuments as jest.Mock) = jest
        .fn()
        .mockResolvedValue(50);

      const result = await repo.findAll({}, 3, 10);

      // skip = (3-1) * 10 = 20
      const skipFn = mockSort.mock.results[0].value.skip;
      expect(skipFn).toHaveBeenCalledWith(20);
      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
    });
  });

  // ────────────────────────────────────────
  // QUERY – count
  // ────────────────────────────────────────
  describe('count', () => {
    it('should count all wallets with empty filter', async () => {
      (WalletModel.countDocuments as jest.Mock) = jest
        .fn()
        .mockResolvedValue(42);

      const result = await repo.count();

      expect(WalletModel.countDocuments).toHaveBeenCalledWith({});
      expect(result).toBe(42);
    });

    it('should count wallets matching filter', async () => {
      (WalletModel.countDocuments as jest.Mock) = jest
        .fn()
        .mockResolvedValue(5);

      const result = await repo.count({ chainId: 1 });

      expect(WalletModel.countDocuments).toHaveBeenCalledWith({ chainId: 1 });
      expect(result).toBe(5);
    });
  });

  // ────────────────────────────────────────
  // MUTATION – upsert
  // ────────────────────────────────────────
  describe('upsert', () => {
    it('should upsert wallet with default values on insert', async () => {
      (WalletModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(mockWallet));

      const result = await repo.upsert('0xABC123', chainId);

      expect(WalletModel.findOneAndUpdate).toHaveBeenCalledWith(
        { walletAddress: '0xabc123', chainId },
        {
          $setOnInsert: {
            balance: 0,
            tradeBalance: 0,
            totalDeposited: 0,
            totalWithdrawn: 0,
          },
        },
        { upsert: true, new: true },
      );
      expect(result).toEqual(mockWallet);
    });
  });

  // ────────────────────────────────────────
  // MUTATION – deposit
  // ────────────────────────────────────────
  describe('deposit', () => {
    it('should deposit amount to balance and totalDeposited', async () => {
      (WalletModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });
      const amount = 100;

      await repo.deposit('0xABC123', chainId, amount);

      expect(WalletModel.updateOne).toHaveBeenCalledWith(
        { walletAddress: '0xabc123', chainId },
        {
          $inc: {
            balance: round(amount),
            totalDeposited: round(amount),
          },
          $setOnInsert: {
            tradeBalance: 0,
            totalWithdrawn: 0,
          },
        },
        { upsert: true },
      );
    });

    it('should lowercase wallet address', async () => {
      (WalletModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });

      await repo.deposit('0xUPPER', chainId, 50);

      expect(WalletModel.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({ walletAddress: '0xupper' }),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should round deposit amount with precision', async () => {
      (WalletModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });
      const amount = 100.123456789;
      const expected = round(amount);

      await repo.deposit(walletAddress, chainId, amount);

      expect(WalletModel.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $inc: { balance: expected, totalDeposited: expected },
        }),
        expect.anything(),
      );
    });
  });

  // ────────────────────────────────────────
  // MUTATION – depositToTrade
  // ────────────────────────────────────────
  describe('depositToTrade', () => {
    it('should move funds from balance to tradeBalance with atomic guard', async () => {
      (WalletModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });
      const amount = 200;

      await repo.depositToTrade('0xABC123', chainId, amount);

      expect(WalletModel.updateOne).toHaveBeenCalledWith(
        {
          walletAddress: '0xabc123',
          chainId,
          balance: { $gte: round(amount) },
        },
        {
          $inc: {
            balance: -round(amount),
            tradeBalance: round(amount),
          },
        },
      );
    });

    it('should throw when balance is insufficient (modifiedCount 0)', async () => {
      (WalletModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 0 });

      await expect(
        repo.depositToTrade(walletAddress, chainId, 200),
      ).rejects.toThrow('Insufficient balance for deposit to trade');
    });

    it('should decrease balance and increase tradeBalance', async () => {
      (WalletModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });
      const amount = 50;

      await repo.depositToTrade(walletAddress, chainId, amount);

      const call = (WalletModel.updateOne as jest.Mock).mock.calls[0];
      const incOps = call[1].$inc;

      expect(incOps.balance).toBe(-round(amount));
      expect(incOps.tradeBalance).toBe(round(amount));
    });
  });

  // ────────────────────────────────────────
  // MUTATION – withdrawFromTrade
  // ────────────────────────────────────────
  describe('withdrawFromTrade', () => {
    it('should move funds from tradeBalance back to balance with atomic guard', async () => {
      (WalletModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });
      const amount = 150;

      await repo.withdrawFromTrade('0xABC123', chainId, amount);

      expect(WalletModel.updateOne).toHaveBeenCalledWith(
        {
          walletAddress: '0xabc123',
          chainId,
          tradeBalance: { $gte: round(amount) },
        },
        {
          $inc: {
            balance: round(amount),
            tradeBalance: -round(amount),
          },
        },
      );
    });

    it('should throw when trade balance is insufficient (modifiedCount 0)', async () => {
      (WalletModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 0 });

      await expect(
        repo.withdrawFromTrade(walletAddress, chainId, 150),
      ).rejects.toThrow('Insufficient trade balance');
    });

    it('should increase balance and decrease tradeBalance', async () => {
      (WalletModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });
      const amount = 75;

      await repo.withdrawFromTrade(walletAddress, chainId, amount);

      const call = (WalletModel.updateOne as jest.Mock).mock.calls[0];
      const incOps = call[1].$inc;

      expect(incOps.balance).toBe(round(amount));
      expect(incOps.tradeBalance).toBe(-round(amount));
    });
  });

  // ────────────────────────────────────────
  // MUTATION – updateTradePnL
  // ────────────────────────────────────────
  describe('updateTradePnL', () => {
    it('should add positive PnL using aggregation pipeline with $max floor', async () => {
      (WalletModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });
      const pnl = 500;

      await repo.updateTradePnL('0xABC123', chainId, pnl);

      expect(WalletModel.updateOne).toHaveBeenCalledWith(
        { walletAddress: '0xabc123', chainId },
        [
          {
            $set: {
              tradeBalance: {
                $max: [0, { $add: ['$tradeBalance', round(pnl)] }],
              },
            },
          },
        ],
        { updatePipeline: true },
      );
    });

    it('should subtract negative PnL with $max floor at 0', async () => {
      (WalletModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });
      const pnl = -300;

      await repo.updateTradePnL(walletAddress, chainId, pnl);

      expect(WalletModel.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        [
          {
            $set: {
              tradeBalance: {
                $max: [0, { $add: ['$tradeBalance', round(pnl)] }],
              },
            },
          },
        ],
        { updatePipeline: true },
      );
    });

    it('should lowercase wallet address', async () => {
      (WalletModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });

      await repo.updateTradePnL('0xMIXED', chainId, 100);

      expect(WalletModel.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({ walletAddress: '0xmixed' }),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  // ────────────────────────────────────────
  // ADMIN – withdraw
  // ────────────────────────────────────────
  describe('withdraw', () => {
    it('should withdraw from balance and increment totalWithdrawn', async () => {
      (WalletModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });
      const amount = 300;

      await repo.withdraw('0xABC123', chainId, amount);

      expect(WalletModel.updateOne).toHaveBeenCalledWith(
        {
          walletAddress: '0xabc123',
          chainId,
          balance: { $gte: round(amount) },
        },
        {
          $inc: {
            balance: -round(amount),
            totalWithdrawn: round(amount),
          },
        },
      );
    });

    it('should throw when balance is insufficient', async () => {
      (WalletModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 0 });

      await expect(repo.withdraw(walletAddress, chainId, 9999)).rejects.toThrow(
        'Insufficient balance for withdrawal',
      );
    });

    it('should round withdrawal amount with precision', async () => {
      (WalletModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });
      const amount = 55.999999999999;

      await repo.withdraw(walletAddress, chainId, amount);

      const call = (WalletModel.updateOne as jest.Mock).mock.calls[0];
      expect(call[1].$inc.balance).toBe(-round(amount));
      expect(call[1].$inc.totalWithdrawn).toBe(round(amount));
    });

    it('should lowercase wallet address', async () => {
      (WalletModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });

      await repo.withdraw('0xGGGG', chainId, 10);

      expect(WalletModel.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({ walletAddress: '0xgggg' }),
        expect.anything(),
      );
    });
  });

  // ────────────────────────────────────────
  // ADMIN – setBalance
  // ────────────────────────────────────────
  describe('setBalance', () => {
    it('should set balance directly with $set', async () => {
      (WalletModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn({ ...mockWallet, balance: 9999 }));
      const newBalance = 9999;

      const result = await repo.setBalance('0xABC123', chainId, newBalance);

      expect(WalletModel.findOneAndUpdate).toHaveBeenCalledWith(
        { walletAddress: '0xabc123', chainId },
        { $set: { balance: round(newBalance) } },
        { new: true },
      );
      expect(result!.balance).toBe(9999);
    });

    it('should return null when wallet does not exist', async () => {
      (WalletModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      const result = await repo.setBalance('0xunknown', chainId, 100);

      expect(result).toBeNull();
    });

    it('should round the new balance value', async () => {
      (WalletModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(mockWallet));
      const rawValue = 123.456789123456789;

      await repo.setBalance(walletAddress, chainId, rawValue);

      expect(WalletModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { $set: { balance: round(rawValue) } },
        expect.anything(),
      );
    });
  });

  // ────────────────────────────────────────
  // ADMIN – setTradeBalance
  // ────────────────────────────────────────
  describe('setTradeBalance', () => {
    it('should set tradeBalance directly with $set', async () => {
      (WalletModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn({ ...mockWallet, tradeBalance: 7777 }));
      const newTradeBalance = 7777;

      const result = await repo.setTradeBalance(
        '0xABC123',
        chainId,
        newTradeBalance,
      );

      expect(WalletModel.findOneAndUpdate).toHaveBeenCalledWith(
        { walletAddress: '0xabc123', chainId },
        { $set: { tradeBalance: round(newTradeBalance) } },
        { new: true },
      );
      expect(result!.tradeBalance).toBe(7777);
    });

    it('should return null when wallet does not exist', async () => {
      (WalletModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      const result = await repo.setTradeBalance('0xunknown', chainId, 100);

      expect(result).toBeNull();
    });

    it('should lowercase wallet address', async () => {
      (WalletModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(mockWallet));

      await repo.setTradeBalance('0xMIXEDCase', chainId, 500);

      expect(WalletModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ walletAddress: '0xmixedcase' }),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  // ────────────────────────────────────────
  // ADMIN – adjustBalance
  // ────────────────────────────────────────
  describe('adjustBalance', () => {
    it('should use aggregation pipeline with $max floor to adjust balance', async () => {
      (WalletModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn({ ...mockWallet, balance: 1200 }));
      const delta = 200;

      const result = await repo.adjustBalance('0xABC123', chainId, delta);

      expect(WalletModel.findOneAndUpdate).toHaveBeenCalledWith(
        { walletAddress: '0xabc123', chainId },
        [
          {
            $set: {
              balance: {
                $max: [0, { $add: ['$balance', round(delta)] }],
              },
            },
          },
        ],
        { new: true },
      );
      expect(result!.balance).toBe(1200);
    });

    it('should handle negative delta (subtract)', async () => {
      const mockFn = jest
        .fn()
        .mockReturnValue(mockLeanReturn({ ...mockWallet, balance: 800 }));
      (WalletModel.findOneAndUpdate as jest.Mock) = mockFn;
      const delta = -200;

      await repo.adjustBalance(walletAddress, chainId, delta);

      expect(mockFn).toHaveBeenCalledWith(
        { walletAddress: walletAddress.toLowerCase(), chainId },
        [
          {
            $set: {
              balance: {
                $max: [0, { $add: ['$balance', round(delta)] }],
              },
            },
          },
        ],
        { new: true },
      );
    });

    it('should return null when wallet not found', async () => {
      (WalletModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      const result = await repo.adjustBalance('0xghost', chainId, 100);

      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────
  // ADMIN – adjustTradeBalance
  // ────────────────────────────────────────
  describe('adjustTradeBalance', () => {
    it('should use aggregation pipeline with $max floor to adjust tradeBalance', async () => {
      (WalletModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn({ ...mockWallet, tradeBalance: 700 }));
      const delta = 200;

      const result = await repo.adjustTradeBalance('0xABC123', chainId, delta);

      expect(WalletModel.findOneAndUpdate).toHaveBeenCalledWith(
        { walletAddress: '0xabc123', chainId },
        [
          {
            $set: {
              tradeBalance: {
                $max: [0, { $add: ['$tradeBalance', round(delta)] }],
              },
            },
          },
        ],
        { new: true },
      );
      expect(result!.tradeBalance).toBe(700);
    });

    it('should handle negative delta (subtract)', async () => {
      const mockFn = jest
        .fn()
        .mockReturnValue(mockLeanReturn({ ...mockWallet, tradeBalance: 300 }));
      (WalletModel.findOneAndUpdate as jest.Mock) = mockFn;
      const delta = -200;

      await repo.adjustTradeBalance(walletAddress, chainId, delta);

      expect(mockFn).toHaveBeenCalledWith(
        { walletAddress: walletAddress.toLowerCase(), chainId },
        [
          {
            $set: {
              tradeBalance: {
                $max: [0, { $add: ['$tradeBalance', round(delta)] }],
              },
            },
          },
        ],
        { new: true },
      );
    });

    it('should return null when wallet not found', async () => {
      (WalletModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      const result = await repo.adjustTradeBalance('0xghost', chainId, 100);

      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────
  // ADMIN – updateWallet
  // ────────────────────────────────────────
  describe('updateWallet', () => {
    it('should update partial wallet data with $set', async () => {
      const updated = { ...mockWallet, balance: 2000, totalDeposited: 3000 };
      (WalletModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(updated));

      const result = await repo.updateWallet('0xABC123', chainId, {
        balance: 2000,
        totalDeposited: 3000,
      });

      expect(WalletModel.findOneAndUpdate).toHaveBeenCalledWith(
        { walletAddress: '0xabc123', chainId },
        { $set: { balance: 2000, totalDeposited: 3000 } },
        { new: true },
      );
      expect(result).toEqual(updated);
    });

    it('should allow updating a single field', async () => {
      (WalletModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(
          mockLeanReturn({ ...mockWallet, totalWithdrawn: 500 }),
        );

      await repo.updateWallet(walletAddress, chainId, {
        totalWithdrawn: 500,
      });

      expect(WalletModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { $set: { totalWithdrawn: 500 } },
        expect.anything(),
      );
    });

    it('should return null when wallet not found', async () => {
      (WalletModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      const result = await repo.updateWallet('0xghost', chainId, {
        balance: 999,
      });

      expect(result).toBeNull();
    });

    it('should lowercase wallet address', async () => {
      (WalletModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(mockWallet));

      await repo.updateWallet('0xMIXED', chainId, { balance: 100 });

      expect(WalletModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ walletAddress: '0xmixed' }),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  // ────────────────────────────────────────
  // ADMIN – resetTotals
  // ────────────────────────────────────────
  describe('resetTotals', () => {
    it('should reset totalDeposited and totalWithdrawn to 0', async () => {
      const reset = {
        ...mockWallet,
        totalDeposited: 0,
        totalWithdrawn: 0,
      };
      (WalletModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(reset));

      const result = await repo.resetTotals('0xABC123', chainId);

      expect(WalletModel.findOneAndUpdate).toHaveBeenCalledWith(
        { walletAddress: '0xabc123', chainId },
        { $set: { totalDeposited: 0, totalWithdrawn: 0 } },
        { new: true },
      );
      expect(result!.totalDeposited).toBe(0);
      expect(result!.totalWithdrawn).toBe(0);
    });

    it('should return null when wallet not found', async () => {
      (WalletModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      const result = await repo.resetTotals('0xghost', chainId);

      expect(result).toBeNull();
    });

    it('should lowercase wallet address', async () => {
      (WalletModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(mockWallet));

      await repo.resetTotals('0xUPPER', chainId);

      expect(WalletModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ walletAddress: '0xupper' }),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  // ────────────────────────────────────────
  // ADMIN – deleteWallet
  // ────────────────────────────────────────
  describe('deleteWallet', () => {
    it('should return true when wallet is deleted', async () => {
      (WalletModel.deleteOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ deletedCount: 1 });

      const result = await repo.deleteWallet('0xABC123', chainId);

      expect(WalletModel.deleteOne).toHaveBeenCalledWith({
        walletAddress: '0xabc123',
        chainId,
      });
      expect(result).toBe(true);
    });

    it('should return false when wallet does not exist', async () => {
      (WalletModel.deleteOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ deletedCount: 0 });

      const result = await repo.deleteWallet('0xghost', chainId);

      expect(result).toBe(false);
    });

    it('should lowercase wallet address', async () => {
      (WalletModel.deleteOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ deletedCount: 1 });

      await repo.deleteWallet('0xDELETE_ME', chainId);

      expect(WalletModel.deleteOne).toHaveBeenCalledWith(
        expect.objectContaining({ walletAddress: '0xdelete_me' }),
      );
    });
  });
});
