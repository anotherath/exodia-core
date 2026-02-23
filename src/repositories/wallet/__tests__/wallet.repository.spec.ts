import { WalletRepository } from '../wallet.repository';
import { WalletModel } from '../wallet.model';
import { roundWithPrecision } from 'src/shared/utils/math.util';
import { BALANCE_CONFIG } from 'src/config/balance.config';

// Mock WalletModel
jest.mock('../wallet.model');

describe('WalletRepository', () => {
  let repository: WalletRepository;

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
    repository = new WalletRepository();
    jest.clearAllMocks();
  });

  // ────────────────────────────────────────
  // find
  // ────────────────────────────────────────
  describe('find', () => {
    it('should return wallet by address and chainId', async () => {
      const mockLean = jest.fn().mockResolvedValue(mockWallet);
      (WalletModel.findOne as jest.Mock) = jest
        .fn()
        .mockReturnValue({ lean: mockLean });

      const result = await repository.find('0xABC123', chainId);

      expect(WalletModel.findOne).toHaveBeenCalledWith({
        walletAddress: '0xabc123',
        chainId,
      });
      expect(result).toEqual(mockWallet);
    });

    it('should return null when wallet not found', async () => {
      const mockLean = jest.fn().mockResolvedValue(null);
      (WalletModel.findOne as jest.Mock) = jest
        .fn()
        .mockReturnValue({ lean: mockLean });

      const result = await repository.find('0xunknown', chainId);

      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────
  // upsert
  // ────────────────────────────────────────
  describe('upsert', () => {
    it('should upsert wallet with default values on insert', async () => {
      const mockLean = jest.fn().mockResolvedValue(mockWallet);
      (WalletModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue({ lean: mockLean });

      const result = await repository.upsert('0xABC123', chainId);

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
  // deposit
  // ────────────────────────────────────────
  describe('deposit', () => {
    it('should deposit amount to balance and totalDeposited', async () => {
      (WalletModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });
      const amount = 100;
      const roundedAmount = roundWithPrecision(
        amount,
        BALANCE_CONFIG.PRECISION,
        false,
      );

      await repository.deposit('0xABC123', chainId, amount);

      expect(WalletModel.updateOne).toHaveBeenCalledWith(
        { walletAddress: '0xabc123', chainId },
        {
          $inc: {
            balance: roundedAmount,
            totalDeposited: roundedAmount,
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

      await repository.deposit('0xUPPER', chainId, 50);

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
      const expectedRounded = roundWithPrecision(
        amount,
        BALANCE_CONFIG.PRECISION,
        false,
      );

      await repository.deposit(walletAddress, chainId, amount);

      expect(WalletModel.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $inc: {
            balance: expectedRounded,
            totalDeposited: expectedRounded,
          },
        }),
        expect.anything(),
      );
    });
  });

  // ────────────────────────────────────────
  // depositToTrade
  // ────────────────────────────────────────
  describe('depositToTrade', () => {
    it('should move funds from balance to tradeBalance', async () => {
      (WalletModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });
      const amount = 200;
      const roundedAmount = roundWithPrecision(
        amount,
        BALANCE_CONFIG.PRECISION,
        false,
      );

      await repository.depositToTrade('0xABC123', chainId, amount);

      expect(WalletModel.updateOne).toHaveBeenCalledWith(
        { walletAddress: '0xabc123', chainId },
        {
          $inc: {
            balance: -roundedAmount,
            tradeBalance: roundedAmount,
          },
        },
      );
    });

    it('should decrease balance and increase tradeBalance', async () => {
      (WalletModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });
      const amount = 50;
      const roundedAmount = roundWithPrecision(
        amount,
        BALANCE_CONFIG.PRECISION,
        false,
      );

      await repository.depositToTrade(walletAddress, chainId, amount);

      const call = (WalletModel.updateOne as jest.Mock).mock.calls[0];
      const incOps = call[1].$inc;

      expect(incOps.balance).toBe(-roundedAmount);
      expect(incOps.tradeBalance).toBe(roundedAmount);
    });
  });

  // ────────────────────────────────────────
  // withdrawFromTrade
  // ────────────────────────────────────────
  describe('withdrawFromTrade', () => {
    it('should move funds from tradeBalance back to balance', async () => {
      (WalletModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });
      const amount = 150;
      const roundedAmount = roundWithPrecision(
        amount,
        BALANCE_CONFIG.PRECISION,
        false,
      );

      await repository.withdrawFromTrade('0xABC123', chainId, amount);

      expect(WalletModel.updateOne).toHaveBeenCalledWith(
        { walletAddress: '0xabc123', chainId },
        {
          $inc: {
            balance: roundedAmount,
            tradeBalance: -roundedAmount,
          },
        },
      );
    });

    it('should increase balance and decrease tradeBalance', async () => {
      (WalletModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });
      const amount = 75;
      const roundedAmount = roundWithPrecision(
        amount,
        BALANCE_CONFIG.PRECISION,
        false,
      );

      await repository.withdrawFromTrade(walletAddress, chainId, amount);

      const call = (WalletModel.updateOne as jest.Mock).mock.calls[0];
      const incOps = call[1].$inc;

      expect(incOps.balance).toBe(roundedAmount);
      expect(incOps.tradeBalance).toBe(-roundedAmount);
    });
  });

  // ────────────────────────────────────────
  // updateTradePnL
  // ────────────────────────────────────────
  describe('updateTradePnL', () => {
    it('should add positive PnL to tradeBalance', async () => {
      (WalletModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });
      const pnl = 500;
      const roundedPnL = roundWithPrecision(
        pnl,
        BALANCE_CONFIG.PRECISION,
        false,
      );

      await repository.updateTradePnL('0xABC123', chainId, pnl);

      expect(WalletModel.updateOne).toHaveBeenCalledWith(
        { walletAddress: '0xabc123', chainId },
        { $inc: { tradeBalance: roundedPnL } },
      );
    });

    it('should subtract negative PnL from tradeBalance', async () => {
      (WalletModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });
      const pnl = -300;
      const roundedPnL = roundWithPrecision(
        pnl,
        BALANCE_CONFIG.PRECISION,
        false,
      );

      await repository.updateTradePnL(walletAddress, chainId, pnl);

      expect(WalletModel.updateOne).toHaveBeenCalledWith(expect.anything(), {
        $inc: { tradeBalance: roundedPnL },
      });
    });

    it('should lowercase wallet address', async () => {
      (WalletModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });

      await repository.updateTradePnL('0xMIXED', chainId, 100);

      expect(WalletModel.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({ walletAddress: '0xmixed' }),
        expect.anything(),
      );
    });
  });

  // ────────────────────────────────────────
  // withdraw
  // ────────────────────────────────────────
  describe('withdraw', () => {
    it('should decrease balance and increase totalWithdrawn', async () => {
      (WalletModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });
      const amount = 100;
      const roundedAmount = roundWithPrecision(
        amount,
        BALANCE_CONFIG.PRECISION,
        false,
      );

      await repository.withdraw('0xABC123', chainId, amount);

      expect(WalletModel.updateOne).toHaveBeenCalledWith(
        { walletAddress: '0xabc123', chainId },
        {
          $inc: {
            balance: -roundedAmount,
            totalWithdrawn: roundedAmount,
          },
        },
      );
    });

    it('should round withdraw amount with precision', async () => {
      (WalletModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });
      const amount = 99.99999;
      const expectedRounded = roundWithPrecision(
        amount,
        BALANCE_CONFIG.PRECISION,
        false,
      );

      await repository.withdraw(walletAddress, chainId, amount);

      const call = (WalletModel.updateOne as jest.Mock).mock.calls[0];
      const incOps = call[1].$inc;

      expect(incOps.balance).toBe(-expectedRounded);
      expect(incOps.totalWithdrawn).toBe(expectedRounded);
    });
  });
});
