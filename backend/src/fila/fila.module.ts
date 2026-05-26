import { Module, forwardRef } from '@nestjs/common';
import { AgendamentoModule } from '../agendamento/agendamento.module';
import { NotificacaoModule } from '../notificacao/notificacao.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SenhaModule } from '../senha/senha.module';
import { FilaController } from './fila.controller';
import { FilaService } from './fila.service';

@Module({
  imports: [
    PrismaModule,
    NotificacaoModule,
    forwardRef(() => AgendamentoModule),
    SenhaModule
  ],
  controllers: [FilaController],
  providers: [FilaService],
  exports: [FilaService],
})
export class FilaModule { }
