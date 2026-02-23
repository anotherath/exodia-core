import { ApiProperty } from '@nestjs/swagger';

export class OpenOrderValueDto {
  @ApiProperty({ example: '0x123...' })
  walletAddress: string;
  @ApiProperty({ example: 'BTC-USDT' })
  symbol: string;
  @ApiProperty({ enum: ['long', 'short'], example: 'long' })
  side: string;
  @ApiProperty({ enum: ['market', 'limit'], example: 'market' })
  type: string;
  @ApiProperty({ example: '100000000', description: 'BigInt string' })
  qty: string;
  @ApiProperty({ example: '50000000000', description: 'BigInt string' })
  entryPrice: string;
  @ApiProperty({ example: '10', description: 'BigInt string' })
  leverage: string;
  @ApiProperty({ example: '45000000000', description: 'BigInt string' })
  sl: string;
  @ApiProperty({ example: '60000000000', description: 'BigInt string' })
  tp: string;
  @ApiProperty({ example: 'nonce123' })
  nonce: string;
}

export class UpdateOrderValueDto {
  @ApiProperty({ example: '0x123...' })
  walletAddress: string;
  @ApiProperty({ example: 'order_id_123' })
  orderId: string;
  @ApiProperty({ example: '200000000' })
  qty: string;
  @ApiProperty({ example: '51000000000' })
  entryPrice: string;
  @ApiProperty({ example: '20' })
  leverage: string;
  @ApiProperty({ example: '46000000000' })
  sl: string;
  @ApiProperty({ example: '61000000000' })
  tp: string;
  @ApiProperty({ example: 'nonce124' })
  nonce: string;
}

export class CancelOrderValueDto {
  @ApiProperty({ example: '0x123...' })
  walletAddress: string;
  @ApiProperty({ example: 'order_id_123' })
  orderId: string;
  @ApiProperty({ example: 'nonce125' })
  nonce: string;
}

export class ClosePositionValueDto {
  @ApiProperty({ example: '0x123...' })
  walletAddress: string;
  @ApiProperty({ example: 'pos_id_123' })
  positionId: string;
  @ApiProperty({ example: 'nonce126' })
  nonce: string;
}

export class UpdatePositionValueDto {
  @ApiProperty({ example: '0x123...' })
  walletAddress: string;
  @ApiProperty({ example: 'pos_id_123' })
  positionId: string;
  @ApiProperty({ example: '20' })
  leverage: string;
  @ApiProperty({ example: '100000000' })
  qty: string;
  @ApiProperty({ example: '45000000000' })
  sl: string;
  @ApiProperty({ example: '60000000000' })
  tp: string;
  @ApiProperty({ example: 'nonce127' })
  nonce: string;
}

// --- Request Bodies ---

export class OpenMarketDto {
  @ApiProperty({ example: '0x123...' })
  walletAddress: string;
  @ApiProperty({ example: 'BTC-USDT' })
  symbol: string;
  @ApiProperty({ enum: ['long', 'short'], example: 'long' })
  side: string;
  @ApiProperty({ example: 0.1 })
  qty: number;
  @ApiProperty({ example: 10 })
  leverage: number;
  @ApiProperty({ example: 45000, required: false })
  sl?: number;
  @ApiProperty({ example: 60000, required: false })
  tp?: number;
  @ApiProperty()
  typedData: OpenOrderValueDto;
  @ApiProperty({ example: '0xsignature...' })
  signature: string;
}

export class OpenLimitDto {
  @ApiProperty({ example: '0x123...' })
  walletAddress: string;
  @ApiProperty({ example: 'BTC-USDT' })
  symbol: string;
  @ApiProperty({ enum: ['long', 'short'], example: 'long' })
  side: string;
  @ApiProperty({ example: 0.1 })
  qty: number;
  @ApiProperty({ example: 48000 })
  entryPrice: number;
  @ApiProperty({ example: 10 })
  leverage: number;
  @ApiProperty({ example: 45000, required: false })
  sl?: number;
  @ApiProperty({ example: 60000, required: false })
  tp?: number;
  @ApiProperty()
  typedData: OpenOrderValueDto;
  @ApiProperty({ example: '0xsignature...' })
  signature: string;
}

export class UpdateOrderDto {
  @ApiProperty({ example: 0.2 })
  qty: number;
  @ApiProperty({ example: 49000 })
  entryPrice: number;
  @ApiProperty({ example: 20 })
  leverage: number;
  @ApiProperty({ example: 46000, required: false })
  sl?: number;
  @ApiProperty({ example: 61000, required: false })
  tp?: number;
  @ApiProperty()
  typedData: UpdateOrderValueDto;
  @ApiProperty({ example: '0xsignature...' })
  signature: string;
}

export class CancelOrderDto {
  @ApiProperty()
  typedData: CancelOrderValueDto;
  @ApiProperty({ example: '0xsignature...' })
  signature: string;
}

export class UpdatePositionDto {
  @ApiProperty({ example: 20 })
  leverage: number;
  @ApiProperty({
    example: 0.1,
    description: 'Khối lượng sau khi update (nếu partial close)',
  })
  qty: number;
  @ApiProperty({ example: 45000, required: false })
  sl?: number;
  @ApiProperty({ example: 60000, required: false })
  tp?: number;
  @ApiProperty()
  typedData: UpdatePositionValueDto;
  @ApiProperty({ example: '0xsignature...' })
  signature: string;
}

export class ClosePositionDto {
  @ApiProperty({ example: 100, description: 'PnL thực tế khi đóng' })
  pnl: number;
  @ApiProperty()
  typedData: ClosePositionValueDto;
  @ApiProperty({ example: '0xsignature...' })
  signature: string;
}
