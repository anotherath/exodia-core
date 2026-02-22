import { Injectable } from '@nestjs/common';
import { NonceRepository } from 'src/repositories/cache/nonce-cache.repository';
import type { HexString } from 'src/shared/types/web3.type';

@Injectable()
export class NonceService {
  constructor(private readonly nonceRepo: NonceRepository) {}

  async getNonce(walletAddress: HexString): Promise<string> {
    const nonceInfo = await this.nonceRepo.findValid(walletAddress);

    if (nonceInfo) return nonceInfo.nonce;

    const newNonce = await this.nonceRepo.upsert(walletAddress);
    return newNonce.nonce;
  }
}
