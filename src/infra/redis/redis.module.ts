import { Global, Module } from '@nestjs/common';
import { RedisModule as NestRedisModule } from '@nestjs-modules/ioredis';
import { redisConfig } from 'src/config/redis.config';

@Global()
@Module({
  imports: [
    NestRedisModule.forRoot({
      type: 'single',
      url: `redis://${redisConfig.host}:${redisConfig.port}`,
    }),
  ],
  exports: [NestRedisModule],
})
export class RedisModule {}
