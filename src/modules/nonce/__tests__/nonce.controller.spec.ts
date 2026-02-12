import { Test, TestingModule } from '@nestjs/testing';
import { NonceController } from '../nonce.controller';
import { NonceService } from '../nonce.service';
import { BadRequestException } from '@nestjs/common';
import { HexString } from 'src/shared/types/web3.type';

describe('NonceController', () => {
  let controller: NonceController;
  let service: jest.Mocked<NonceService>;

  const walletAddress =
    '0x1234567890123456789012345678901234567890' as HexString;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NonceController],
      providers: [
        {
          provide: NonceService,
          useValue: {
            getNonce: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<NonceController>(NonceController);
    service = module.get(NonceService);
  });

  it('nên trả về nonce thành công', async () => {
    const mockNonce = {
      walletAddress: walletAddress.toLowerCase(),
      nonce: 'fake_nonce',
      expiresAt: new Date(),
    };
    service.getNonce.mockResolvedValue(mockNonce as any);

    const result = await controller.getNonce(walletAddress);

    expect(service.getNonce).toHaveBeenCalledWith(walletAddress);
    expect(result).toEqual({
      nounce: mockNonce,
    });
  });

  it('nên lỗi nếu walletAddress không hợp lệ', async () => {
    await expect(controller.getNonce('abc' as any)).rejects.toThrow(
      BadRequestException,
    );
  });
});
