import { ApiProperty } from '@nestjs/swagger';
import { HexString } from 'src/shared/types/web3.type';

export class ActivateUserDto {
  @ApiProperty({
    description: 'Địa chỉ ví của người dùng',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  walletAddress: string;

  @ApiProperty({
    description: 'Nonce nhận được từ API /nounce/get-nonce',
    example: 'a1b2c3d4e5f6g7h8',
  })
  nonce: string;

  @ApiProperty({
    description: 'Thời điểm ký bản tin (ISO string)',
    example: '2024-03-20T10:00:00Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Chữ ký EIP-712',
    example: '0x...',
  })
  signature: HexString;
}
