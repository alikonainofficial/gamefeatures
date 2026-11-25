import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { webOrigins } from './common/web-origins';

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

  // CORS: WEB_URL may list several origins (comma-separated). In the deployed demo the browser
  // calls the API through the web app's own origin (Next.js rewrites), so CORS mostly matters
  // for local development and direct API calls.
  app.enableCors({
    origin: webOrigins(configService.get<string>('WEB_URL')),
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
