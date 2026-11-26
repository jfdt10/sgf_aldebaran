import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { HealthController } from '../src/health.controller';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Database health (e2e)', () => {
  let app: INestApplication<App>;
  const query = jest.fn();

  beforeEach(async () => {
    query.mockReset();
    const fixture = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: { $queryRaw: query } }],
    }).compile();
    app = fixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 200 if the database responds', async () => {
    query.mockResolvedValue([{ result: 1 }]);
    await request(app.getHttpServer()).get('/health').expect(200, { status: 'ok' });
  });

  it('returns 503 without exposing an internal database error', async () => {
    query.mockRejectedValue(new Error('private database error'));
    const response = await request(app.getHttpServer()).get('/health').expect(503);
    expect(response.body.message).toBe('Database unavailable');
  });
});
