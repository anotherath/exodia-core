import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Response } from 'express';

@Catch(ThrottlerException)
export class ThrottlerExceptionFilter implements ExceptionFilter {
  catch(exception: ThrottlerException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(429).json({
      success: false,
      statusCode: 429,
      message: 'Bạn đang gửi quá nhiều yêu cầu, vui lòng thử lại sau',
      error: 'Too Many Requests',
    });
  }
}
