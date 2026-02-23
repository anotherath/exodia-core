import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PositionService } from './position.service';
import {
  OpenMarketDto,
  OpenLimitDto,
  UpdateOrderDto,
  CancelOrderDto,
  UpdatePositionDto,
  ClosePositionDto,
} from './dto/position-api.dto';
import { throttlerConfig } from 'src/config/throttler.config';

@ApiTags('Position')
@Controller()
export class PositionController {
  constructor(private readonly positionService: PositionService) {}

  /* ===================== ORDERS ===================== */

  @Post('orders/market')
  @Throttle(throttlerConfig.trading.market)
  @ApiOperation({ summary: 'Mở lệnh Market (khớp ngay)' })
  @ApiResponse({
    status: 201,
    description: 'Lệnh đã được khớp và vị thế đã mở',
  })
  openMarket(@Body() body: OpenMarketDto) {
    const { signature, typedData, ...data } = body;
    return this.positionService.openMarket(
      data as any,
      typedData as any,
      signature as any,
    );
  }

  @Post('orders/limit')
  @Throttle(throttlerConfig.trading.limit)
  @ApiOperation({ summary: 'Mở lệnh Limit (đợi khớp)' })
  @ApiResponse({ status: 201, description: 'Lệnh giới hạn đã được tạo' })
  openLimit(@Body() body: OpenLimitDto) {
    const { signature, typedData, ...data } = body;
    return this.positionService.openLimit(
      data as any,
      typedData as any,
      signature as any,
    );
  }

  @Put('orders/:id')
  @Throttle(throttlerConfig.trading.update)
  @ApiOperation({ summary: 'Chỉnh sửa lệnh Limit đang chờ (Pending)' })
  @ApiParam({
    name: 'id',
    description: 'ID của lệnh (Position ID với status pending)',
  })
  @ApiResponse({ status: 200, description: 'Cập nhật lệnh thành công' })
  updateOrder(@Param('id') id: string, @Body() body: UpdateOrderDto) {
    const { signature, typedData, ...data } = body;
    return this.positionService.updatePending(
      id,
      data as any,
      typedData as any,
      signature as any,
    );
  }

  @Delete('orders/:id')
  @Throttle(throttlerConfig.trading.cancel)
  @ApiOperation({ summary: 'Hủy lệnh Limit đang chờ' })
  @ApiParam({ name: 'id', description: 'ID của lệnh cần hủy' })
  @ApiResponse({ status: 200, description: 'Hủy lệnh thành công' })
  cancelOrder(@Param('id') id: string, @Body() body: CancelOrderDto) {
    const { signature, typedData } = body;
    return this.positionService.cancelOrder(
      id,
      typedData as any,
      signature as any,
    );
  }

  @Get('orders/open')
  @Throttle(throttlerConfig.trading.read)
  @ApiOperation({ summary: 'Lấy các lệnh đang chờ (Pending Orders) của ví' })
  @ApiQuery({ name: 'walletAddress', example: '0x123...' })
  getOpenOrders(@Query('walletAddress') wallet: string) {
    return this.positionService.getOpenOrders(wallet);
  }

  @Get('orders/history')
  @Throttle(throttlerConfig.trading.history)
  @ApiOperation({ summary: 'Lấy lịch sử các lệnh đã đóng hoặc hủy' })
  @ApiQuery({ name: 'walletAddress', example: '0x123...' })
  getOrderHistory(@Query('walletAddress') wallet: string) {
    return this.positionService.getOrderHistory(wallet);
  }

  /* ===================== POSITIONS ===================== */

  @Get('positions')
  @Throttle(throttlerConfig.trading.read)
  @ApiOperation({ summary: 'Lấy các vị thế đang mở (Active Positions) của ví' })
  @ApiQuery({ name: 'walletAddress', example: '0x123...' })
  getPositions(@Query('walletAddress') wallet: string) {
    return this.positionService.getActivePositions(wallet);
  }

  @Get('positions/:id')
  @Throttle(throttlerConfig.trading.read)
  @ApiOperation({ summary: 'Lấy thông tin chi tiết một vị thế' })
  @ApiParam({ name: 'id', description: 'ID của vị thế' })
  getPosition(@Param('id') id: string) {
    return this.positionService.getById(id);
  }

  @Put('positions/:id')
  @Throttle(throttlerConfig.trading.update)
  @ApiOperation({
    summary: 'Cập nhật vị thế (Điều chỉnh đòn bẩy, SL/TP hoặc đóng một phần)',
  })
  @ApiParam({ name: 'id', description: 'ID của vị thế đang mở' })
  updatePosition(@Param('id') id: string, @Body() body: UpdatePositionDto) {
    const { signature, typedData, ...data } = body;
    return this.positionService.updateOpen(
      id,
      data as any,
      typedData as any,
      signature as any,
    );
  }

  @Post('positions/:id/close')
  @Throttle(throttlerConfig.trading.close)
  @ApiOperation({ summary: 'Đóng vị thế toàn phần' })
  @ApiParam({ name: 'id', description: 'ID của vị thế cần đóng' })
  closePosition(@Param('id') id: string, @Body() body: ClosePositionDto) {
    const { signature, typedData, pnl } = body;
    return this.positionService.close(
      id,
      pnl,
      typedData as any,
      signature as any,
    );
  }

  @Get('positions/history')
  @Throttle(throttlerConfig.trading.history)
  @ApiOperation({ summary: 'Lấy lịch sử các vị thế đã đóng' })
  @ApiQuery({ name: 'walletAddress', example: '0x123...' })
  getPositionHistory(@Query('walletAddress') wallet: string) {
    return this.positionService.getHistory(wallet);
  }
}
