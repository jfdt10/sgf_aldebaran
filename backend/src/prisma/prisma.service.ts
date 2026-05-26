import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private pool?: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not configured');
    }

    const isProduction =
      process.env.NODE_ENV === 'production' ||
      (!connectionString.includes('localhost') && !connectionString.includes('127.0.0.1'));

    const pool = new Pool({
      connectionString,
      ssl: isProduction ? { rejectUnauthorized: false } : undefined,
    });
    const adapter = new PrismaPg(pool);

    super({
      adapter,
      errorFormat: 'pretty',
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['warn', 'error'],
    });

    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
    try {
      await this.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS unaccent;');
    } catch (e) {
      console.warn('Could not ensure unaccent extension is installed:', e);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    if (this.pool) {
      await this.pool.end();
    }
  }
}
