import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not configured');
    }

    const databaseUrl = new URL(connectionString);
    const isRenderInternal = /^dpg-[a-z0-9-]+$/.test(databaseUrl.hostname);
    const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname);
    const sslMode = databaseUrl.searchParams.get('sslmode');

    if (isRenderInternal && sslMode === 'require' && !databaseUrl.searchParams.has('uselibpqcompat')) {
      databaseUrl.searchParams.set('uselibpqcompat', 'true');
    }

    const pool = new Pool({
      connectionString: databaseUrl.toString(),
      connectionTimeoutMillis: 5000,
      keepAlive: true,
      ssl: isRenderInternal ? { rejectUnauthorized: false } : !isLocal,
    });
    const logger = new Logger(PrismaService.name);
    pool.on('error', (error: NodeJS.ErrnoException) => {
      logger.warn('PostgreSQL lost an idle connection (' + (error.code ?? error.name) + ')');
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
    try {
      await this.$disconnect();
    } finally {
      await this.pool.end();
    }
  }
}
