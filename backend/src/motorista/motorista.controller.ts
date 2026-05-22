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
  HttpException,
  HttpStatus,
  UseGuards,
  Patch,
  Request,
} from '@nestjs/common';
import { MotoristaService } from './motorista.service';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LogService } from '../log/log.service';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@Controller('motoristas')
@UseGuards(JwtAuthGuard)
export class MotoristaController {
  constructor(
    private readonly motoristaService: MotoristaService,
    private readonly logService: LogService,
  ) {}

  @Post()
  async create(
    @Body() createMotoristaDto: Prisma.motoristaCreateInput,
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      const res = await this.motoristaService.create(createMotoristaDto, req.user.filial_id);
      await this.logService.logAction(
        'Criação',
        `Criou motorista: ${res.nome}`,
        req.user.userId,
        'Motorista',
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
    return this.motoristaService.findAll(q, filialId ? +filialId : undefined, req?.user?.filial_id);
  }

  @Get('check')
  check(@Query('cpf') cpf: string, @Query('cnh') cnh: string) {
    return this.motoristaService.checkExists(cpf, cnh);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req: AuthenticatedRequest) {
    return this.motoristaService.findOne(id, req.user.filial_id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMotoristaDto: Prisma.motoristaUpdateInput,
    @Request() req: AuthenticatedRequest,
  ) {
    const res = await this.motoristaService.update(id, updateMotoristaDto, req.user.filial_id);
    const userId = req.user.userId;
    await this.logService.logAction(
      'Atualização',
      `Atualizou motorista: ${res.nome}`,
      userId,
      'Motorista',
      'Sucesso',
      res.filial_id ?? undefined,
    );
    return res;
  }

  @Patch(':id/status')
  async toggleStatus(@Param('id', ParseIntPipe) id: number, @Request() req: AuthenticatedRequest) {
    const res = await this.motoristaService.toggleStatus(id, req.user.filial_id);
    const userId = req.user.userId;
    const acao = res.ativo ? 'Ativação' : 'Inativação';
    await this.logService.logAction(
      acao,
      `Alterou status do motorista: ${res.nome}`,
      userId,
      'Motorista',
      'Sucesso',
      res.filial_id ?? undefined,
    );
    return res;
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Request() req: AuthenticatedRequest) {
    const res = await this.motoristaService.softDelete(id, req.user.filial_id);
    const userId = req.user.userId;
    await this.logService.logAction(
      'Exclusão',
      `Excluiu motorista: ${res.nome}`,
      userId,
      'Motorista',
      'Sucesso',
      res.filial_id ?? undefined,
    );
    return res;
  }
}
