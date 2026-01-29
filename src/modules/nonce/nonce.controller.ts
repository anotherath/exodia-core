import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { NonceService } from './nonce.service';
import type { HexString } from 'src/shared/types/web3.type';
import { isHexString } from 'src/shared/utils/web3.util';

@Controller('nounce')
export class NonceController {
  constructor(private readonly nonceService: NonceService) {}

  @Get('get-nonce')
  async getNonce(@Query('walletAddress') walletAddress: HexString) {
    if (!isHexString(walletAddress)) {
      throw new BadRequestException('walletAddress is required');
    }

    const nounce = await this.nonceService.getNonce(walletAddress);

    return {
      nounce: nounce,
    };
  }
}
