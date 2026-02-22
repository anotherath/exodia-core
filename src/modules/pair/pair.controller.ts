import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { PairService } from './pair.service';
import { CreatePairDto, UpdatePairStatusDto } from './dto/pair.dto';

@ApiTags('Pairs')
@Controller('pairs')
export class PairController {
  constructor(private readonly pairService: PairService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả các cặp giao dịch' })
  @ApiResponse({ status: 200, description: 'Trả về mảng các cặp giao dịch' })
  getAll() {
    return this.pairService.getAll();
  }

  @Get('active')
  @ApiOperation({ summary: 'Lấy danh sách các cặp đang hoạt động' })
  @ApiResponse({
    status: 200,
    description: 'Trả về mảng các cặp isActive = true',
  })
  getAllActive() {
    return this.pairService.getAllActive();
  }

  @Post()
  @ApiOperation({ summary: 'Tạo mới hoặc cập nhật thông tin cặp giao dịch' })
  @ApiResponse({ status: 201, description: 'Lưu thành công' })
  upsert(@Body() body: CreatePairDto) {
    return this.pairService.upsertPair(body);
  }

  @Put(':instId/status')
  @ApiOperation({ summary: 'Cập nhật trạng thái hoạt động của cặp giao dịch' })
  @ApiParam({ name: 'instId', example: 'BTC-USDT' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  updateStatus(
    @Param('instId') instId: string,
    @Body() body: UpdatePairStatusDto,
  ) {
    return this.pairService.updateStatus(instId, body.isActive);
  }

  @Delete(':instId')
  @ApiOperation({ summary: 'Xóa một cặp giao dịch' })
  @ApiParam({ name: 'instId', example: 'BTC-USDT' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  delete(@Param('instId') instId: string) {
    return this.pairService.deletePair(instId);
  }
}
