import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from '../user.controller';
import { UserService } from '../user.service';
import { HexString } from 'src/shared/types/web3.type';
import { ActivateUserValue } from 'src/shared/types/eip712.type';

describe('UserController', () => {
  let controller: UserController;
  let service: jest.Mocked<UserService>;

  const walletAddress =
    '0x1234567890123456789012345678901234567890' as HexString;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: {
            isActiveUser: jest.fn(),
            activeUser: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    service = module.get(UserService);
  });

  describe('isActiveUser', () => {
    it('should return active status', async () => {
      service.isActiveUser.mockResolvedValue(true);

      const result = await controller.isActiveUser(walletAddress);

      expect(service.isActiveUser).toHaveBeenCalledWith(walletAddress);
      expect(result).toEqual({
        walletAddress,
        isActive: true,
      });
    });

    it('should return false if user not active', async () => {
      service.isActiveUser.mockResolvedValue(false);

      const result = await controller.isActiveUser(walletAddress);

      expect(result.isActive).toBe(false);
    });
  });

  describe('activateUser', () => {
    it('should activate user and return status', async () => {
      const body = {
        walletAddress,
        nonce: 'nonce123',
        timestamp: '2023-01-01T00:00:00Z',
        signature: '0xsig' as HexString,
      };
      service.activeUser.mockResolvedValue(true);

      const result = await controller.activateUser(body as any);

      expect(service.activeUser).toHaveBeenCalledWith(
        expect.objectContaining({
          walletAddress,
          nonce: 'nonce123',
        }),
        '0xsig',
      );
      expect(result).toEqual({
        walletAddress,
        isActive: true,
      });
    });

    it('should return isActive false if activation fails', async () => {
      const body = {
        walletAddress,
        nonce: 'nonce123',
        timestamp: '2023-01-01T00:00:00Z',
        signature: '0xsig' as HexString,
      };
      service.activeUser.mockResolvedValue(false);

      const result = await controller.activateUser(body as any);

      expect(result.isActive).toBe(false);
    });
  });
});
