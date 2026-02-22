import { ApiProperty } from '@nestjs/swagger';

export class WalletTransactionDto {
  @ApiProperty({
    description: 'Địa chỉ ví người dùng',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  walletAddress: string;

  @ApiProperty({
    description: 'ID của chain',
    example: 1,
  })
  chainId: number;

  @ApiProperty({
    description: 'Số lượng tiền',
    example: 100,
  })
  amount: number;
}
