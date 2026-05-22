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
import { GuicheService } from './guiche.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LogService } from '../log/log.service';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@Controller('guiches')
@UseGuards(JwtAuthGuard)
export class GuicheController {
  constructor(
    private readonly guicheService: GuicheService,
    private readonly logService: LogService,
  ) {}

  @Post()
  async create(@Body() data: any, @Request() req: AuthenticatedRequest) {
    const res = await this.guicheService.create(data, req.user.filial_id);
    await this.logService.logAction(
      'Criação',
      `Criou novo guichê: ${res.nome}`,
      req.user.userId,
      'Guichê',
      'Sucesso',
      res.filial_id ?? undefined,
    );
    return res;
  }

  @Get()
  findAll(@Query('filialId') filialId?: string, @Request() req?: AuthenticatedRequest) {
    return this.guicheService.findAll(
      filialId ? +filialId : undefined,
      req?.user?.filial_id,
    );
  }

  @Get('operador')
  async listOperatorGuiches(@Query('filialId') filialId?: string, @Request() req?: AuthenticatedRequest) {
    return await this.guicheService.findAll(
      filialId ? +filialId : undefined,
      req?.user?.filial_id,
    );
  }

  @Get('operador/atual')
  async getCurrentOperatorGuiche(@Request() req: AuthenticatedRequest) {
    const userId = req.user.userId;
    return await this.guicheService.findCurrentByOperator(userId);
  }

  @Post('operador/selecionar')
  async selectGuiche(@Body() body: { guicheId: number }, @Request() req: AuthenticatedRequest) {
    const userId = req.user.userId;
    const res = await this.guicheService.selectGuiche(body.guicheId, userId);
    await this.logService.logAction(
      'Seleção de Guichê',
      `Operador selecionou o guichê ${res.numero}`,
      userId,
      'Guichê',
      'Sucesso',
      res.filial_id ?? undefined,
    );
    return res;
  }

  @Post('operador/liberar')
  async releaseCurrentGuiche(@Request() req: AuthenticatedRequest) {
    const userId = req.user.userId;
    const res = await this.guicheService.releaseGuiche(userId);
    if (!res) {
      return { message: 'Nenhum guichê ocupado no momento', guiche: null };
    }
    await this.logService.logAction(
      'Liberação de Guichê',
      `Operador liberou o guichê ${res.numero}`,
      userId,
      'Guichê',
      'Sucesso',
      res.filial_id ?? undefined,
    );
    return { message: 'Guichê liberado com sucesso', guiche: res };
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.guicheService.findOne(+id, req.user.filial_id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() data: any,
    @Request() req: AuthenticatedRequest,
  ) {
    const res = await this.guicheService.update(+id, data, req.user.filial_id);
    await this.logService.logAction(
      'Atualização',
      `Atualizou dados do guichê: ${res.nome}`,
      req.user.userId,
      'Guichê',
      'Sucesso',
      res.filial_id ?? undefined,
    );
    return res;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const guiche = await this.guicheService.findOne(+id, req.user.filial_id);
    const res = await this.guicheService.remove(+id, req.user.filial_id);
    await this.logService.logAction(
      'Exclusão',
      `Excluiu guichê: ${guiche.nome}`,
      req.user.userId,
      'Guichê',
      'Sucesso',
      guiche.filial_id ?? undefined,
    );
    return res;
  }

}
