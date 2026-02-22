import { ApiProperty } from '@nestjs/swagger';

export class CreatePairDto {
  @ApiProperty({ description: 'ID của cặp giao dịch', example: 'BTC-USDT' })
  instId: string;

  @ApiProperty({ description: 'Đòn bẩy tối đa cho phép', example: 100 })
  maxLeverage: number;

  @ApiProperty({
    description: 'Khối lượng giao dịch tối thiểu',
    example: 0.001,
  })
  minVolume: number;

  @ApiProperty({
    description: 'Tỷ lệ phí mở lệnh (ví dụ: 0.0001 = 0.01%)',
    example: 0.0001,
  })
  openFeeRate: number;

  @ApiProperty({
    description: 'Tỷ lệ phí đóng lệnh (ví dụ: 0.0001 = 0.01%)',
    example: 0.0001,
  })
  closeFeeRate: number;

  @ApiProperty({ description: 'Trạng thái hoạt động', example: true })
  isActive: boolean;
}

export class UpdatePairStatusDto {
  @ApiProperty({ description: 'Trạng thái hoạt động mới', example: true })
  isActive: boolean;
}
