import { Test, TestingModule } from '@nestjs/testing';
import { NonceService } from '../nonce.service';
import { NonceRepository } from 'src/repositories/cache/nonce-cache.repository';

describe('NonceService', () => {
  let service: NonceService;
  let nonceRepo: jest.Mocked<NonceRepository>;

  const walletAddress = '0x1111111111111111111111111111111111111111';
  const fakeNonce = '1234567890abcdef';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NonceService,
        {
          provide: NonceRepository,
          useValue: {
            findValid: jest.fn(),
            upsert: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NonceService>(NonceService);
    nonceRepo = module.get(NonceRepository);
  });

  it(' nên trả về nonce hiện tại nếu còn hiệu lực', async () => {
    nonceRepo.findValid.mockResolvedValue({
      walletAddress: walletAddress.toLowerCase(),
      nonce: fakeNonce,
      expiresAt: new Date(Date.now() + 100000),
    });

    const result = await service.getNonce(walletAddress);

    expect(result).toBe(fakeNonce);
    expect(nonceRepo.findValid).toHaveBeenCalledWith(walletAddress);
    expect(nonceRepo.upsert).not.toHaveBeenCalled();
  });

  it(' nên tạo và trả về nonce mới nếu không tìm thấy nonce hợp lệ', async () => {
    nonceRepo.findValid.mockResolvedValue(null);
    nonceRepo.upsert.mockResolvedValue({
      walletAddress: walletAddress.toLowerCase(),
      nonce: fakeNonce,
      expiresAt: new Date(Date.now() + 100000),
    });

    const result = await service.getNonce(walletAddress);

    expect(result).toBe(fakeNonce);
    expect(nonceRepo.findValid).toHaveBeenCalledWith(walletAddress);
    expect(nonceRepo.upsert).toHaveBeenCalledWith(walletAddress);
  });
});
