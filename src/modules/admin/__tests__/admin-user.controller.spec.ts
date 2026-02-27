import { Test, TestingModule } from '@nestjs/testing';
import { AdminUserController } from '../admin-user.controller';
import { UserRepository } from 'src/repositories/user/user.repository';
import { AdminAuthGuard } from 'src/shared/guards/admin-auth.guard';
import { RolesGuard } from 'src/shared/guards/roles.guard';

describe('AdminUserController', () => {
  let controller: AdminUserController;
  let userRepo: jest.Mocked<UserRepository>;

  const mockAdmin = {
    username: 'test-admin',
    role: 'operator',
  };

  beforeEach(async () => {
    const mockUserRepo = {
      findAllIncludeDeleted: jest.fn(),
      updateUser: jest.fn(),
      hardDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminUserController],
      providers: [{ provide: UserRepository, useValue: mockUserRepo }],
    })
      .overrideGuard(AdminAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminUserController>(AdminUserController);
    userRepo = module.get(UserRepository);
  });

  describe('getUsers', () => {
    it('should call userRepo.findAllIncludeDeleted with correct filters', async () => {
      const mockResult = { data: [], total: 0, page: 1, limit: 20 };
      userRepo.findAllIncludeDeleted.mockResolvedValue(mockResult);

      const result = await controller.getUsers(
        '1',
        '20',
        '0x123',
        'admin',
        'false',
      );

      expect(userRepo.findAllIncludeDeleted).toHaveBeenCalledWith(
        { walletAddress: '0x123', role: 'admin', isActive: false },
        1,
        20,
      );
      expect(result).toBe(mockResult);
    });
  });

  describe('updateUser', () => {
    it('should call userRepo.updateUser', async () => {
      const updateData = { isActive: true };
      userRepo.updateUser.mockResolvedValue({
        walletAddress: '0x123',
        ...updateData,
      } as any);

      const result = await controller.updateUser('0x123', updateData, {
        admin: mockAdmin,
      });

      expect(userRepo.updateUser).toHaveBeenCalledWith('0x123', updateData);
      expect(result.isActive).toBe(true);
    });
  });

  describe('deleteUser', () => {
    it('should call userRepo.hardDelete', async () => {
      userRepo.hardDelete.mockResolvedValue(true);

      const result = await controller.deleteUser('0x123', { admin: mockAdmin });

      expect(userRepo.hardDelete).toHaveBeenCalledWith('0x123');
      expect(result).toEqual({ success: true });
    });
  });
});
