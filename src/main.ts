import { NestFactory } from '@nestjs/core';
import { UsersModule } from './modules/users/users.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import 'dotenv/config';
import { connectMongoDB } from './infra/mongodb';

async function bootstrap() {
  await connectMongoDB();
  const app = await NestFactory.create(UsersModule);

  const config = new DocumentBuilder()
    .setTitle('My API')
    .setDescription('API documentation')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
