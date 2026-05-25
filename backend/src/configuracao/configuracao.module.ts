import { Module, forwardRef } from '@nestjs/common';
import { ConfiguracaoService } from './configuracao.service';
import { ConfiguracaoController } from './configuracao.controller';
import { CronService } from './cron.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificacaoModule } from '../notificacao/notificacao.module';
import { LogModule } from '../log/log.module';
import { FilaModule } from '../fila/fila.module';

@Module({
  imports: [
    PrismaModule,
    NotificacaoModule,
    LogModule,
    forwardRef(() => FilaModule)
  ],
  controllers: [ConfiguracaoController],
  providers: [ConfiguracaoService, CronService],
  exports: [ConfiguracaoService],
})
export class ConfiguracaoModule { }
