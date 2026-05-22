import { PrismaPg } from '@prisma/adapter-pg';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not configured');
    }

    const adapter = new PrismaPg({ connectionString });

    super({
      adapter,
      errorFormat: 'pretty',
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['warn', 'error'],
    });
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
  }
}
