import { Module } from '@nestjs/common';
import { NotificacaoService } from './notificacao.service';
import { NotificacaoGateway } from './notificacao.gateway';
import { NotificacaoController } from './notificacao.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [NotificacaoController],
  providers: [NotificacaoService, NotificacaoGateway],
  exports: [NotificacaoService, NotificacaoGateway],
})
export class NotificacaoModule {}
