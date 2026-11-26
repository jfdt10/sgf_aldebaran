import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccountManagementGuard, StaffGuard } from '../auth/account-role.guards';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { ValidarCheckinDto } from './dto/validar-checkin.dto';
import { FilaService } from './fila.service';

@Controller('fila')
export class FilaController {
  constructor(private readonly filaService: FilaService) { }

  @Post('totem/senha')
  solicitarSenhaTotem(
    @Body()
    body: {
      tipo: string;
      categoria?: string;
      categoriaId?: number;
      filialId?: number;
      qtdeGarrafoes?: number;
    },
  ) {
    return this.filaService.solicitarSenhaTotem(
      body.tipo,
      body.categoria,
      body.filialId,
      body.categoriaId,
      body.qtdeGarrafoes,
    );
  }

  @Post('checkin/validar')
  validarCheckin(@Body() body: ValidarCheckinDto) {
    return this.filaService.validarCheckin(body.codigo, body.filialId, body.tipo);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Post('checkin/operacional')
  validarCheckinOperacional(@Body() body: ValidarCheckinDto, @Request() req: AuthenticatedRequest) {
    return this.filaService.validarCheckin(body.codigo, req.user.filial_id ?? body.filialId, body.tipo, body.ignorarRegras);
  }

  @UseGuards(JwtAuthGuard, AccountManagementGuard)
  @Get('dashboard-stats')
  getDashboardStats() {
    return this.filaService.getDashboardData();
  }

  @Get('agendamento/horarios')
  getHorarios(
    @Query('data') data: string,
    @Query('filialId') filialId?: string,
    @Query('servicoId') servicoId?: string,
  ) {
    return this.filaService.horariosDisponiveis(
      data,
      filialId ? +filialId : undefined,
      servicoId ? +servicoId : undefined,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('agendamento')
  criarAgendamento(@Body() body: any, @Request() req: AuthenticatedRequest) {
    const dados = req.user.tipo === 'CLIENTE'
      ? { ...body, documento: req.user.email }
      : { ...body, filial_id: req.user.filial_id ?? body.filial_id };
    return this.filaService.criarAgendamento(dados);
  }

  @UseGuards(JwtAuthGuard)
  @Get('agendamento')
  listarAgendamentos(
    @Request() req: AuthenticatedRequest,
    @Query('filialId') filialId?: string,
  ) {
    return this.filaService.listarAgendamentos(
      filialId ? +filialId : undefined,
      req.user,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('agendamento/:id')
  buscarAgendamento(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.filaService.buscarAgendamento(+id, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('agendamento/:id')
  excluirAgendamento(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.filaService.excluirAgendamento(+id, req.user);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Post('agendamento/:id/resgatar')
  resgatarAgendamento(
    @Param('id') id: string,
  ) {
    return this.filaService.resgatarAgendamento(+id);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Post('senha/:id/resgatar')
  resgatarSenha(
    @Param('id') id: string,
  ) {
    return this.filaService.resgatarSenha(+id);
  }

  @UseGuards(JwtAuthGuard, AccountManagementGuard)
  @Post('servicos')
  criarServico(@Body() body: { nome: string; sigla: string }) {
    return this.filaService.criarServico(body.nome, body.sigla);
  }

  @Get('servicos')
  listarServicos() {
    return this.filaService.listarServicos();
  }

  @UseGuards(JwtAuthGuard, AccountManagementGuard)
  @Patch('servicos/:id')
  atualizarServico(@Param('id') id: string, @Body() body: any) {
    return this.filaService.atualizarServico(+id, body);
  }

  @UseGuards(JwtAuthGuard, AccountManagementGuard)
  @Delete('servicos/:id')
  excluirServico(@Param('id') id: string) {
    return this.filaService.excluirServico(+id);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Post('solicitar_senha')
  solicitarSenha(@Body() body: { servico_id: number }) {
    return this.filaService.solicitarSenha(body.servico_id);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Post('chamar_proximo')
  chamarProximo(@Body() body: { guiche: number; repetir?: boolean }) {
    return this.filaService.chamarProximo(body.guiche, !!body.repetir);
  }

  @UseGuards(JwtAuthGuard, AccountManagementGuard)
  @Post('zerar')
  zerarFila(@Body() body: { filialId?: number }, @Request() req: AuthenticatedRequest) {
    return this.filaService.zerarFila(req.user.filial_id ?? body.filialId);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Post('chamar_especifico')
  chamarEspecifico(@Body() body: { guiche: number; senhaId: number }) {
    return this.filaService.chamarEspecifico(body.guiche, body.senhaId);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Patch('senha/:id/cancelar')
  cancelarSenha(@Param('id') id: string) {
    return this.filaService.cancelarSenha(+id);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Get('operador/proximas')
  async listarProximas(@Request() req: any) {
    const guicheId = Number(req.headers['x-guiche-id']);
    if (!guicheId) return [];
    return this.filaService.listarProximas(guicheId);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Get('operador/atual')
  async buscarAtendimentoAtual(@Request() req: any) {
    const guicheId = Number(req.headers['x-guiche-id']);
    if (!guicheId) return null;
    return this.filaService.buscarAtendimentoAtual(guicheId);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Get('operador/atendimentos')
  listarAtendimentosOperador(
    @Request() req: AuthenticatedRequest,
    @Query('filialId') filialId?: string,
    @Query('data') data?: string,
  ) {
    const fid = filialId ? +filialId : req.user.filial_id;
    return this.filaService.listarAtendimentosOperador(req.user.userId, fid, data);
  }

  @UseGuards(JwtAuthGuard, AccountManagementGuard)
  @Get('supervisor/atendimentos')
  listarAtendimentosSupervisor(
    @Request() req: AuthenticatedRequest,
    @Query('filialId') filialId?: string,
    @Query('data') data?: string,
  ) {
    const fid = filialId ? +filialId : req.user.filial_id;
    return this.filaService.listarAtendimentosSupervisor(fid, data);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Post('iniciar_atendimento')
  iniciarAtendimento(@Body() body: { senhaId: number }) {
    return this.filaService.iniciarAtendimento(body.senhaId);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Post('finalizar_atendimento')
  finalizarAtendimento(@Body() body: { senhaId: number }) {
    return this.filaService.finalizarAtendimento(body.senhaId);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Patch('senha/:id/cliente')
  vincularCliente(
    @Param('id') id: string,
    @Body() body: { nome: string; documento?: string; clienteId?: string },
  ) {
    return this.filaService.vincularCliente(+id, body.nome, body.documento, body.clienteId);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Patch('senha/:id/garrafoes')
  atualizarGarrafoes(
    @Param('id') id: string,
    @Body() body: { qtdeGarrafoes: number },
  ) {
    return this.filaService.atualizarGarrafoes(+id, body.qtdeGarrafoes);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Post('nao_compareceu')
  naoCompareceu(@Body() body: { senhaId: number }) {
    return this.filaService.naoCompareceu(body.senhaId);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Post('transferir')
  transferirAtendimento(
    @Request() req: AuthenticatedRequest,
    @Body()
    body: { senhaId: number; guicheDestinoId?: number; retornarFila?: boolean },
  ) {
    return this.filaService.transferirAtendimento(
      body.senhaId,
      body.guicheDestinoId ?? null,
      !!body.retornarFila,
      req.user,
    );
  }

  @Get('painel')
  painel(@Query('filialId') filialId?: string) {
    return this.filaService.listarPainel(filialId ? +filialId : undefined);
  }

  @Post('avaliar')
  avaliar(@Body() body: { numero: string; nota: number }) {
    return this.filaService.avaliarAtendimento(body.numero, body.nota);
  }

  @Get('status/:id')
  consultarStatus(@Param('id') id: string) {
    return this.filaService.consultarPosicao(+id);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Patch('atendimento/:id/justificar')
  justificarDemora(
    @Param('id') id: string,
    @Body() body: { justificativaDemora: string; motivoDemora: string },
  ) {
    return this.filaService.justificarDemora(+id, body);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Get('historico')
  getHistorico(@Query('sala') sala: string) {
    return this.filaService.getHistorico(sala);
  }
}
