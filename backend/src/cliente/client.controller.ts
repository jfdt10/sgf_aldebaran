import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { ClientService } from './client.service';
import { CreateClienteDto } from './dto/create-client.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard, StaffGuard } from '../auth/account-role.guards';
import { PasswordDto } from '../auth/password.dto';
import { LogService } from '../log/log.service';

@Controller('clientes')
export class ClienteController {
  constructor(
    private readonly clienteService: ClientService,
    private readonly logService: LogService,
  ) {}

  @Post('autocadastro')
  async createPublic(@Body() createClienteDto: CreateClienteDto) {
    const res = await this.clienteService.createPublic(createClienteDto);
    await this.logService.logAction(
      'Autocadastro',
      `Novo autocadastro de cliente: ${res.nome}`,
      undefined,
      'Cliente',
    );
    return res;
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Post()
  async createOperacional(
    @Body() createClienteDto: any,
    @Request() req: any,
  ) {
    const res = await this.clienteService.createOperacional(createClienteDto);
    const userId = req.user?.userId ?? req.user?.id;
    await this.logService.logAction(
      'Criação',
      `Cliente cadastrado via sistema: ${res.nome}`,
      userId,
      'Cliente',
    );
    return res;
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Get()
  findAll(@Request() req: any, @Query('filialId') filialId?: string, @Query('busca') busca?: string) {
    return this.clienteService.findAll(
      req.user.filial_id ?? (filialId ? +filialId : undefined),
      busca?.trim() || undefined,
    );
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Get('check')
  check(
    @Query('cpf') cpf?: string,
    @Query('cnpj') cnpj?: string,
    @Query('email') email?: string,
  ) {
    return this.clienteService.checkExists(cpf, cnpj, email);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.clienteService.findOne(id, req.user.filial_id);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateClienteDto: any,
    @Request() req: any,
  ) {
    const res = await this.clienteService.update(id, updateClienteDto, req.user.filial_id);
    const userId = req.user?.userId ?? req.user?.id;
    await this.logService.logAction(
      'Atualização',
      `Atualizou cliente: ${res.nome}`,
      userId,
      'Cliente',
    );
    return res;
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Patch(':id/status')
  async toggleStatus(@Param('id') id: string, @Request() req: any) {
    const res = await this.clienteService.toggleStatus(id, req.user.filial_id);
    const userId = req.user?.userId ?? req.user?.id;
    const acao = res.deletedAt ? 'Inativação' : 'Ativação';
    await this.logService.logAction(
      acao,
      `Alterou status do cliente: ${res.nome}`,
      userId,
      'Cliente',
    );
    return res;
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(':id/senha')
  async resetPassword(
    @Param('id') id: string,
    @Body() body: PasswordDto,
    @Request() req: any,
  ) {
    const res = await this.clienteService.resetPassword(id, body.senha, req.user.filial_id);
    const userId = req.user?.userId ?? req.user?.id;
    await this.logService.logAction(
      'Reset de Senha',
      `Resetou senha do cliente: ${res.nome}`,
      userId,
      'Cliente',
    );
    return res;
  }
}
