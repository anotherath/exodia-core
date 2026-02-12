import { Test, TestingModule } from '@nestjs/testing';
import { PositionController } from '../position.controller';
import { PositionService } from '../position.service';

describe('PositionController', () => {
  let controller: PositionController;
  let service: jest.Mocked<PositionService>;

  const mockBody = {
    signature: '0xsig',
    typedData: { nonce: 'n1' },
    symbol: 'BTC-USDT',
    qty: 1,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PositionController],
      providers: [
        {
          provide: PositionService,
          useValue: {
            openMarket: jest.fn(),
            openLimit: jest.fn(),
            updatePending: jest.fn(),
            cancelOrder: jest.fn(),
            getOpenOrders: jest.fn(),
            getOrderHistory: jest.fn(),
            getActivePositions: jest.fn(),
            getById: jest.fn(),
            updateOpen: jest.fn(),
            close: jest.fn(),
            getHistory: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PositionController>(PositionController);
    service = module.get(PositionService);
  });

  describe('Orders', () => {
    it('openMarket nên gọi service đúng params', async () => {
      const { signature, typedData, ...data } = mockBody;
      await controller.openMarket(mockBody);
      expect(service.openMarket).toHaveBeenCalledWith(
        data,
        typedData,
        signature,
      );
    });

    it('openLimit nên gọi service đúng params', async () => {
      const { signature, typedData, ...data } = mockBody;
      await controller.openLimit(mockBody);
      expect(service.openLimit).toHaveBeenCalledWith(
        data,
        typedData,
        signature,
      );
    });

    it('updateOrder nên gọi service đúng params', async () => {
      const { signature, typedData, ...data } = mockBody;
      await controller.updateOrder('id123', mockBody);
      expect(service.updatePending).toHaveBeenCalledWith(
        'id123',
        data,
        typedData,
        signature,
      );
    });

    it('cancelOrder nên gọi service đúng params', async () => {
      await controller.cancelOrder('id123', mockBody);
      expect(service.cancelOrder).toHaveBeenCalledWith(
        'id123',
        mockBody.typedData,
        mockBody.signature,
      );
    });

    it('getOpenOrders nên gọi service', async () => {
      await controller.getOpenOrders('0xwallet');
      expect(service.getOpenOrders).toHaveBeenCalledWith('0xwallet');
    });

    it('getOrderHistory nên gọi service', async () => {
      await controller.getOrderHistory('0xwallet');
      expect(service.getOrderHistory).toHaveBeenCalledWith('0xwallet');
    });
  });

  describe('Positions', () => {
    it('getPositions nên gọi service', async () => {
      await controller.getPositions('0xwallet');
      expect(service.getActivePositions).toHaveBeenCalledWith('0xwallet');
    });

    it('getPosition nên gọi service', async () => {
      await controller.getPosition('id123');
      expect(service.getById).toHaveBeenCalledWith('id123');
    });

    it('updatePosition nên gọi service đúng params', async () => {
      const { signature, typedData, ...data } = mockBody;
      await controller.updatePosition('id123', mockBody);
      expect(service.updateOpen).toHaveBeenCalledWith(
        'id123',
        data,
        typedData,
        signature,
      );
    });

    it('closePosition nên gọi service đúng params', async () => {
      const closeBody = { ...mockBody, pnl: 100 };
      await controller.closePosition('id123', closeBody);
      expect(service.close).toHaveBeenCalledWith(
        'id123',
        100,
        closeBody.typedData,
        closeBody.signature,
      );
    });

    it('getPositionHistory nên gọi service', async () => {
      await controller.getPositionHistory('0xwallet');
      expect(service.getHistory).toHaveBeenCalledWith('0xwallet');
    });
  });
});
