import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  configureApp(app);

  // On SIGTERM (a Render deploy or restart), close HTTP, sockets, Prisma, Redis and BullMQ
  // cleanly through the modules' shutdown hooks instead of dropping connections mid-request.
  app.enableShutdownHooks();

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Game Review API')
    .setDescription('Gaming Feature Request Platform API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = configService.get('PORT') || 3001;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`Application is running on port ${port}`);
  logger.log(`Swagger docs: /docs`);
}
bootstrap();
