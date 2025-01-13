// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as dotenv from 'dotenv';
import { ValidationPipe } from '@nestjs/common';
import { UdpAdapter } from 'nest-udp-adapter';
// import { UdpServer } from './udp-server';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useWebSocketAdapter(
    new UdpAdapter(
      app,
      //   {
      //   type: 'udp4',
      //   port: 3003,
      // }),
    ),
  );

  // const udpServer = new UdpServer({
  //   // host: '127.0.0.1',
  //   host: '127.0.0.1',
  //   port: 3003,
  // });

  // app.connectMicroservice({
  //   strategy: udpServer,
  // });

  // await app.startAllMicroservices();

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      // forbidNonWhitelisted: true,
      // whitelist: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Access Control API')
    .setDescription('API for managing device commands and configurations')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  app.enableCors();

  // Get the port from .env file or default to 3002
  const port = process.env.PORT || 3003;

  // Debug log the port
  console.debug(`Starting application on port: ${port}`);

  await app.listen(port, '0.0.0.0');
}
bootstrap();
