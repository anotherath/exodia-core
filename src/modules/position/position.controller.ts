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
import { PositionService } from './position.service';

@Controller()
export class PositionController {
  constructor(private readonly positionService: PositionService) {}

  /* ===================== ORDERS ===================== */

  // mở lệnh market
  @Post('orders/market')
  openMarket(@Body() body: any) {
    return this.positionService.openMarket(body);
  }

  // mở lệnh limit
  @Post('orders/limit')
  openLimit(@Body() body: any) {
    return this.positionService.openLimit(body);
  }

  // edit order limit (chưa khớp)
  @Put('orders/:id')
  updateOrder(@Param('id') id: string, @Body() body: any) {
    return this.positionService.updatePending(id, body);
  }

  // hủy order limit
  @Delete('orders/:id')
  cancelOrder(@Param('id') id: string) {
    return this.positionService.cancelOrder(id);
  }

  // order đang mở (pending)
  @Get('orders/open')
  getOpenOrders(@Query('walletAddress') wallet: string) {
    return this.positionService.getOpenOrders(wallet);
  }

  // lịch sử order (closed)
  @Get('orders/history')
  getOrderHistory(@Query('walletAddress') wallet: string) {
    return this.positionService.getOrderHistory(wallet);
  }

  /* ===================== POSITIONS ===================== */

  // lấy position đang active
  @Get('positions')
  getPositions(@Query('walletAddress') wallet: string) {
    return this.positionService.getActivePositions(wallet);
  }

  // lấy position theo id
  @Get('positions/:id')
  getPosition(@Param('id') id: string) {
    return this.positionService.getById(id);
  }

  // edit position đang mở (leverage, SL/TP sau này)
  @Put('positions/:id')
  updatePosition(@Param('id') id: string, @Body() body: any) {
    return this.positionService.updateOpen(id, body);
  }

  // đóng position toàn phần
  @Post('positions/:id/close')
  closePosition(@Param('id') id: string, @Body() body: any) {
    return this.positionService.close(id, body);
  }

  // history position
  @Get('positions/history')
  getPositionHistory(@Query('walletAddress') wallet: string) {
    return this.positionService.getHistory(wallet);
  }
}
