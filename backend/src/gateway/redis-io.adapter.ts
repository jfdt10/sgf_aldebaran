import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { INestApplicationContext } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private clients: ReturnType<typeof createClient>[] = [];
  private adapterConstructor: ReturnType<typeof createAdapter>;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(redisUrl: string): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      const pubClient = createClient({ url: redisUrl });
      const subClient = pubClient.duplicate();
      this.clients = [pubClient, subClient];
      for (const client of this.clients) {
        client.on('error', (error: unknown) => {
          if (client.isReady) console.warn('[RedisIoAdapter]', error);
        });
      }

      await Promise.race([
        Promise.all([pubClient.connect(), subClient.connect()]),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Redis connection timeout')), 5000);
        }),
      ]);

      this.adapterConstructor = createAdapter(pubClient, subClient);
      return true;
    } catch (error) {
      await this.dispose();
      console.warn(
        '⚠️ [RedisIoAdapter] Falha ao conectar ao Redis. Usando adaptador local (sem escalabilidade horizontal).',
      );
      console.warn('Erro:', error.message);
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  async dispose(): Promise<void> {
    for (const client of this.clients) {
      if (client.isOpen) client.destroy();
    }
    this.clients = [];
    await super.dispose();
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket'],
    });

    server.adapter(this.adapterConstructor);
    return server;
  }
}
