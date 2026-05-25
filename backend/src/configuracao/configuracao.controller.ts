import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { ConfiguracaoService } from './configuracao.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LogService } from '../log/log.service';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@Controller('configuracoes')
@UseGuards(JwtAuthGuard)
export class ConfiguracaoController {
  constructor(
    private readonly configuracaoService: ConfiguracaoService,
    private readonly logService: LogService,
  ) {}

  @Get('lista')
  findAllList(@Query('filialId') filialId?: string, @Request() req?: AuthenticatedRequest) {
    return this.configuracaoService.findAllList(filialId, req?.user?.filial_id);
  }

  @Post('bulk')
  async updateBulk(
    @Request() req: AuthenticatedRequest,
    @Body('configs') configs: { chave: string; valor: string }[],
    @Query('filialId') filialId?: string,
  ) {
    const res = await this.configuracaoService.updateBulk(configs, filialId, req.user.filial_id);
    await this.logService.logAction(
      'Configuração',
      `Atualizou múltiplas configurações - ${res.filialNome}`,
      req.user.userId,
      'Configuração',
      'Sucesso',
      filialId ? +filialId : undefined,
    );
    return res;
  }

  @Post('calibrar-sla')
  async calibrarSla(
    @Request() req: AuthenticatedRequest,
    @Body() body: { filialId?: number; servicoId?: number },
  ) {
    return this.configuracaoService.calibrarSla({
      ...body,
      usuarioId: req.user.userId,
    });
  }
}
