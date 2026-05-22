import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  Patch,
  HttpException,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CaminhaoService } from './caminhao.service';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LogService } from '../log/log.service';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@Controller('caminhoes')
@UseGuards(JwtAuthGuard)
export class CaminhaoController {
  constructor(
    private readonly caminhaoService: CaminhaoService,
    private readonly logService: LogService,
  ) {}
  @Post()
  async create(
    @Body() createCaminhaoDto: Prisma.caminhaoCreateInput,
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      const res = await this.caminhaoService.create(createCaminhaoDto, req.user.filial_id);
      const userId = req.user?.userId ?? req.user?.id;
      await this.logService.logAction(
        'Criação',
        `Criou caminhão placa ${res.placa}`,
        req.user.userId,
        'Caminhão',
        'Sucesso',
        res.filial_id ?? undefined,
      );
      return res;
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Erro Interno',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('operacional')
  async createOperacional(
    @Body() createCaminhaoDto: Prisma.caminhaoCreateInput,
    @Request() req: AuthenticatedRequest,
  ) {
    // RN02 — Cadastro Operacional Simplificado: Operador e Supervisor não vinculam motoristas.
    if (createCaminhaoDto.motorista) {
      delete createCaminhaoDto.motorista;
    }
    try {
      const res = await this.caminhaoService.create(createCaminhaoDto, req.user.filial_id);
      const userId = req.user?.userId ?? req.user?.id;
      await this.logService.logAction(
        'Criação',
        `Criou caminhão (operacional) placa ${res.placa}`,
        req.user.userId,
        'Caminhão',
        'Sucesso',
        res.filial_id ?? undefined,
      );
      return res;
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Erro Interno',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  findAll(@Query('q') q?: string, @Query('filialId') filialId?: string, @Request() req?: AuthenticatedRequest) {
    return this.caminhaoService.findAll(q, filialId ? +filialId : undefined, req?.user?.filial_id);
  }

  @Get('check')
  check(@Query('placa') placa: string) {
    return this.caminhaoService.checkExists(placa);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req: AuthenticatedRequest) {
    return this.caminhaoService.findOne(id, req.user.filial_id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCaminhaoDto: Prisma.caminhaoUpdateInput,
    @Request() req: AuthenticatedRequest,
  ) {
    const res = await this.caminhaoService.update(id, updateCaminhaoDto, req.user.filial_id);
    const userId = req.user.userId;
    await this.logService.logAction(
      'Atualização',
      `Atualizou caminhão placa ${res.placa}`,
      userId,
      'Caminhão',
      'Sucesso',
      res.filial_id ?? undefined,
    );
    return res;
  }

  @Patch(':id/motorista')
  async vincularMotorista(
    @Param('id', ParseIntPipe) id: number,
    @Body('motoristaId') motoristaId: number | null,
    @Request() req: AuthenticatedRequest,
  ) {
    const res = await this.caminhaoService.vincularMotorista(id, motoristaId);
    const userId = req.user.userId;
    const acao = motoristaId ? 'Vinculação' : 'Desvinculação';
    await this.logService.logAction(
      acao,
      `Alterou motorista do caminhão placa ${res.placa}`,
      userId,
      'Caminhão',
      'Sucesso',
      res.filial_id ?? undefined,
    );
    return res;
  }

  @Patch(':id/status')
  async toggleStatus(@Param('id', ParseIntPipe) id: number, @Request() req: AuthenticatedRequest) {
    const res = await this.caminhaoService.toggleStatus(id, req.user.filial_id);
    const userId = req.user.userId;
    const acao = res.status === 'ATIVO' ? 'Ativação' : 'Inativação';
    await this.logService.logAction(
      acao,
      `Alterou status do caminhão placa ${res.placa}`,
      userId,
      'Caminhão',
      'Sucesso',
      res.filial_id ?? undefined,
    );
    return res;
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Request() req: AuthenticatedRequest) {
    const res = await this.caminhaoService.softDelete(id, req.user.filial_id);
    const userId = req.user.userId;
    await this.logService.logAction(
      'Exclusão',
      `Excluiu caminhão placa ${res.placa}`,
      userId,
      'Caminhão',
      'Sucesso',
      res.filial_id ?? undefined,
    );
    return res;
  }
}
