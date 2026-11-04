
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  const configuredOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  const allowedOrigins = [
    'http://localhost:3000',
    ...configuredOrigins,
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header (health checks, etc.).
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.replace(/\/$/, '');

      const isAllowed =
        allowedOrigins.includes(normalizedOrigin) ||
        /^https:\/\/[a-zA-Z0-9-]+(?:-[a-zA-Z0-9-]+)*\.vercel\.app$/.test(
          normalizedOrigin,
        );

      if (isAllowed) {
        return callback(null, true);
      }

      return callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env.PORT) || 4000;

  await app.listen(port);

  console.log(`MarketHub API is running at http://localhost:${port}`);
}

await bootstrap();
