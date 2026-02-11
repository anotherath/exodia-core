import { PairService } from '../pair.service';
import { PairRepository } from 'src/repositories/pair/pair.repository';
import { connectTestDB, closeTestDB } from 'test/mongo-memory';
import { PairModel } from 'src/repositories/pair/pair.model';

describe('PairService', () => {
  let service: PairService;
  let pairRepo: PairRepository;

  beforeAll(async () => {
    await connectTestDB();
    pairRepo = new PairRepository();
    service = new PairService(pairRepo);
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await PairModel.deleteMany({});
  });

  it('should return all active pairs', async () => {
    const activePairs = [
      { instId: 'BTC-USDT', maxLeverage: 100, isActive: true },
      { instId: 'ETH-USDT', maxLeverage: 50, isActive: true },
    ];
    const inactivePair = {
      instId: 'SOL-USDT',
      maxLeverage: 20,
      isActive: false,
    };

    await PairModel.insertMany([...activePairs, inactivePair]);

    const result = await service.getAllActive();

    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ instId: 'BTC-USDT' }),
        expect.objectContaining({ instId: 'ETH-USDT' }),
      ]),
    );
    expect(result).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ instId: 'SOL-USDT' })]),
    );
  });

  it('should return a pair by instId if it is active', async () => {
    const instId = 'BTC-USDT';
    await PairModel.create({ instId, maxLeverage: 100, isActive: true });

    const result = await service.getByInstId(instId);

    expect(result).not.toBeNull();
    expect(result?.instId).toBe(instId);
  });

  it('should return null if pair by instId is inactive', async () => {
    const instId = 'SOL-USDT';
    await PairModel.create({ instId, maxLeverage: 20, isActive: false });

    const result = await service.getByInstId(instId);

    expect(result).toBeNull();
  });

  it('should return null if pair by instId does not exist', async () => {
    const result = await service.getByInstId('NON-EXISTENT');

    expect(result).toBeNull();
  });
});
