import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { ServicoService } from './servico.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LogService } from '../log/log.service';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@Controller('servicos')
export class ServicoController {
  constructor(
    private readonly servicoService: ServicoService,
    private readonly logService: LogService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() createServicoDto: any, @Request() req: AuthenticatedRequest) {
    const res = await this.servicoService.create(createServicoDto, req.user.filial_id);
    await this.logService.logAction(
      'Criação',
      `Criou nova categoria: ${res.nome}`,
      req.user.userId,
      'Categoria',
      'Sucesso',
      res.filial_id ?? undefined,
    );
    return res;
  }

  @Get('public/list')
  findAllPublic(
    @Query('filialId') filialId?: string,
    @Query('tipo') tipo?: string,
  ) {
    return this.servicoService.findAll(
      filialId ? +filialId : undefined,
      tipo,
      false,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(
    @Query('filialId') filialId?: string,
    @Query('includeInactive') includeInactive?: string,
    @Request() req?: AuthenticatedRequest,
  ) {
    return this.servicoService.findAll(
      filialId ? +filialId : undefined,
      undefined,
      includeInactive === 'true',
      req?.user?.filial_id,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.servicoService.findOne(+id, req.user.filial_id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateServicoDto: any,
    @Request() req: AuthenticatedRequest,
  ) {
    const res = await this.servicoService.update(+id, updateServicoDto, req.user.filial_id);
    await this.logService.logAction(
      'Atualização',
      `Atualizou categoria: ${res.nome}`,
      req.user.userId,
      'Categoria',
      'Sucesso',
      res.filial_id ?? undefined,
    );
    return res;
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const s = await this.servicoService.findOne(+id, req.user.filial_id);
    const res = await this.servicoService.remove(+id, req.user.filial_id);
    await this.logService.logAction(
      'Exclusão',
      `Excluiu categoria: ${s.nome}`,
      req.user.userId,
      'Categoria',
      'Sucesso',
      s.filial_id ?? undefined,
    );
    return res;
  }
}
