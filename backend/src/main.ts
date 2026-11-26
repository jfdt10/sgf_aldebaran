import 'dotenv/config';
import { allowApplicationOrigin } from './common/cors';

if (!global.crypto) {
  global.crypto = require('crypto');
}

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { RedisIoAdapter } from './gateway/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();

  const redisIoAdapter = new RedisIoAdapter(app);
  const redisUrl = process.env.REDIS_URL ||
    (process.env.NODE_ENV === 'production' ? undefined : 'redis://localhost:6379');
  const isRedisConnected = redisUrl && await redisIoAdapter.connectToRedis(redisUrl);

  if (isRedisConnected) {
    app.useWebSocketAdapter(redisIoAdapter);
    console.log('🔌 Redis WebSockets Habilitado');
  } else {
    console.log('💡 Usando adaptador WebSocket padrão (In-memory)');
  }

  app.use((_, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });

  app.enableCors({
    origin: allowApplicationOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  console.log('Backend escutando na porta', port);
}
bootstrap();
