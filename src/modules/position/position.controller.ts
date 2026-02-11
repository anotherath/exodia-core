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
    const { signature, typedData, ...data } = body;
    return this.positionService.openMarket(data, typedData, signature);
  }

  // mở lệnh limit
  @Post('orders/limit')
  openLimit(@Body() body: any) {
    const { signature, typedData, ...data } = body;
    return this.positionService.openLimit(data, typedData, signature);
  }

  // edit order limit (chưa khớp)
  @Put('orders/:id')
  updateOrder(@Param('id') id: string, @Body() body: any) {
    const { signature, typedData, ...data } = body;
    return this.positionService.updatePending(id, data, typedData, signature);
  }

  // hủy order limit
  @Delete('orders/:id')
  cancelOrder(@Param('id') id: string, @Body() body: any) {
    const { signature, typedData } = body;
    return this.positionService.cancelOrder(id, typedData, signature);
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
    const { signature, typedData, ...data } = body;
    return this.positionService.updateOpen(id, data, typedData, signature);
  }

  // đóng position toàn phần
  @Post('positions/:id/close')
  closePosition(@Param('id') id: string, @Body() body: any) {
    const { signature, typedData, pnl } = body;
    return this.positionService.close(id, pnl, typedData, signature);
  }

  // history position
  @Get('positions/history')
  getPositionHistory(@Query('walletAddress') wallet: string) {
    return this.positionService.getHistory(wallet);
  }
}
