import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { NonceService } from './nonce.service';
import type { HexString } from 'src/shared/types/web3.type';
import { isHexString } from 'src/shared/utils/web3.util';
import { throttlerConfig } from 'src/config/throttler.config';

@ApiTags('Nonce')
@Controller('nonce')
export class NonceController {
  constructor(private readonly nonceService: NonceService) {}

  @Get('get-nonce')
  @Throttle(throttlerConfig.nonce)
  @ApiOperation({ summary: 'Lấy mã Nonce để ký bản tin EIP-712' })
  @ApiQuery({
    name: 'walletAddress',
    description: 'Địa chỉ ví của người dùng',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  @ApiResponse({
    status: 200,
    description: 'Trả về mã nonce (chuỗi hex ngẫu nhiên)',
  })
  async getNonce(@Query('walletAddress') walletAddress: HexString) {
    if (!isHexString(walletAddress)) {
      throw new BadRequestException('walletAddress is required');
    }

    const nonce = await this.nonceService.getNonce(walletAddress);

    return {
      nonce: nonce,
    };
  }
}
