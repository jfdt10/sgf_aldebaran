import { Controller, Get, Post, Body, Query, Request, UseGuards } from '@nestjs/common';
import { LogService } from './log.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@Controller('logs')
export class LogController {
  constructor(private readonly logService: LogService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Query() query: any, @Request() req: AuthenticatedRequest) {
    return this.logService.findAll(query, req.user.filial_id);
  }

  // Opcional: Rota POST manual caso o Front end precise gravar logs de erros (US-0099)
  @Post()
  create(
    @Body() body: { acao: string; descricao: string; usuario_id?: number },
  ) {
    return this.logService.logAction(
      body.acao,
      body.descricao,
      body.usuario_id,
    );
  }
}
