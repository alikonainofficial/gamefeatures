import {
  ArgumentsHost,
  Catch,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@game-review/database';

/**
 * Turns the Prisma errors that describe a client mistake into the right HTTP status.
 * Returns null for everything else, which must stay a 500.
 */
export function mapPrismaError(
  error: Prisma.PrismaClientKnownRequestError,
): HttpException | null {
  switch (error.code) {
    // Unique constraint failed: duplicate username, double vote, etc.
    case 'P2002': {
      const target = error.meta?.target;
      const fields = Array.isArray(target)
        ? target.map(String)
        : typeof target === 'string'
          ? [target]
          : [];
      const message =
        fields.length > 0
          ? `A record with this ${fields.join(', ')} already exists`
          : 'A record with these values already exists';
      return new ConflictException({ statusCode: 409, error: 'Conflict', message, fields });
    }

    // The record to update/delete does not exist.
    case 'P2025':
      return new NotFoundException(
        typeof error.meta?.cause === 'string' ? error.meta.cause : 'Resource not found',
      );

    // Foreign key constraint failed: the referenced row (e.g. the request being voted on) is gone.
    case 'P2003':
      return new NotFoundException('Related resource not found');

    default:
      return null;
  }
}

/**
 * Registered globally with APP_FILTER (AppModule), so the e2e tests get it automatically.
 * Unmapped Prisma errors go to Nest's default handler, which logs them and returns 500.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    super.catch(mapPrismaError(exception) ?? exception, host);
  }
}
