import { Injectable } from '@nestjs/common';
import { UserModel } from './user.model';
import { User } from 'src/shared/types/user.type';

@Injectable()
export class UserRepository {
  private baseQuery() {
    return { deletedAt: null };
  }

  // kiem thong tin bang wallet
  async findByWallet(walletAddress: string): Promise<User | null> {
    return UserModel.findOne({
      walletAddress: walletAddress.toLowerCase(),
      ...this.baseQuery(),
    }).lean();
  }

  // tao user moi
  async create(walletAddress: string, chainId?: number): Promise<User> {
    return UserModel.create({
      walletAddress: walletAddress.toLowerCase(),
      chainId,
    });
  }

  // tin kiem thong tin user
  // neu co thi thay doi thong tin theo du lieu truyen vao
  // neu khong thi tao user moi
  async upsert(walletAddress: string, data: Partial<User>): Promise<User> {
    return UserModel.findOneAndUpdate(
      { walletAddress: walletAddress.toLowerCase() },
      { $set: data, $setOnInsert: { deletedAt: null } },
      { upsert: true, new: true },
    ).lean();
  }

  // xoa user
  async softDelete(walletAddress: string): Promise<void> {
    await UserModel.updateOne(
      { walletAddress: walletAddress.toLowerCase() },
      { $set: { deletedAt: new Date(), isActive: false } },
    );
  }

  // khoi phuc user
  async restore(walletAddress: string): Promise<void> {
    await UserModel.updateOne(
      { walletAddress: walletAddress.toLowerCase() },
      { $set: { deletedAt: null, isActive: true } },
    );
  }
}
