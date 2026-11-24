import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@game-review/database';
import { mapPrismaError } from './prisma-exception.filter';

const known = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError(`prisma error ${code}`, {
    code,
    clientVersion: 'test',
    meta,
  });

describe('mapPrismaError', () => {
  it('maps P2002 (unique constraint) to 409 with the conflicting fields', () => {
    const mapped = mapPrismaError(known('P2002', { target: ['username'] }));

    expect(mapped).toBeInstanceOf(ConflictException);
    expect(mapped!.getStatus()).toBe(409);
    expect(mapped!.getResponse()).toMatchObject({
      statusCode: 409,
      error: 'Conflict',
      fields: ['username'],
      message: 'A record with this username already exists',
    });
  });

  it('handles a P2002 target given as a constraint name', () => {
    const mapped = mapPrismaError(known('P2002', { target: 'Vote_userId_requestId_key' }));
    expect(mapped!.getResponse()).toMatchObject({ fields: ['Vote_userId_requestId_key'] });
  });

  it('handles a P2002 without metadata', () => {
    const mapped = mapPrismaError(known('P2002'));
    expect(mapped!.getStatus()).toBe(409);
    expect(mapped!.getResponse()).toMatchObject({ fields: [], message: 'A record with these values already exists' });
  });

  it('maps P2025 (record not found) to 404', () => {
    const mapped = mapPrismaError(known('P2025', { cause: 'Record to update not found.' }));
    expect(mapped).toBeInstanceOf(NotFoundException);
    expect(mapped!.getStatus()).toBe(404);
  });

  it('maps P2003 (foreign key) to 404 "Related resource not found"', () => {
    const mapped = mapPrismaError(known('P2003', { field_name: 'Vote_requestId_fkey (index)' }));
    expect(mapped).toBeInstanceOf(NotFoundException);
    expect(mapped!.getResponse()).toMatchObject({ message: 'Related resource not found' });
  });

  it('leaves any other code unmapped so it stays a logged 500', () => {
    expect(mapPrismaError(known('P2034'))).toBeNull();
  });
});
