import { Controller, Get, Post, Param, ParseIntPipe, Request, UseGuards } from '@nestjs/common';
import { NotificacaoService } from './notificacao.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@Controller('notificacoes')
@UseGuards(JwtAuthGuard)
export class NotificacaoController {
  constructor(private readonly notificacaoService: NotificacaoService) {}

  @Get()
  findAll(@Request() req: AuthenticatedRequest) {
    const { usuarioId, clienteId } = this.destinatario(req);
    return this.notificacaoService.listarParaUsuario(usuarioId, clienteId);
  }

  @Post(':id/lida')
  markAsRead(@Param('id', ParseIntPipe) id: number, @Request() req: AuthenticatedRequest) {
    const { usuarioId, clienteId } = this.destinatario(req);
    return this.notificacaoService.marcarComoLida(id, usuarioId, clienteId);
  }

  @Post('todas-lidas')
  markAllAsRead(@Request() req: AuthenticatedRequest) {
    const { usuarioId, clienteId } = this.destinatario(req);
    return this.notificacaoService.marcarTodasComoLidas(usuarioId, clienteId);
  }

  private destinatario(req: AuthenticatedRequest) {
    const userId = req.user.userId;
    return typeof userId === 'string' ? { clienteId: userId } : { usuarioId: userId };
  }
}
