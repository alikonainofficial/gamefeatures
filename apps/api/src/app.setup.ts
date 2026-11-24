import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

/**
 * The HTTP pipeline shared by `main.ts` and the e2e tests, so tests exercise exactly
 * the middleware, prefix and validation that production uses.
 */
export function configureApp(app: INestApplication): INestApplication {
  const configService = app.get(ConfigService);

  // Behind proxies (Vercel -> Render), req.ip must be the client's IP, or rate limiting would
  // throttle everyone sharing the proxy. Trust exactly TRUST_PROXY_HOPS hops (default: none).
  (app as NestExpressApplication).set(
    'trust proxy',
    Number(configService.get('TRUST_PROXY_HOPS') ?? 0) || 0,
  );

  // Security
  app.use(helmet());
  app.use(cookieParser());

  // CORS
  app.enableCors({
    origin: configService.get('WEB_URL') || 'http://localhost:3000',
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  return app;
}
