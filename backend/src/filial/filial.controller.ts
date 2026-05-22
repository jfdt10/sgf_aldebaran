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
import { FilialService } from './filial.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LogService } from '../log/log.service';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { CreateFilialDto } from './dto/create-filial.dto';
import { UpdateFilialDto } from './dto/update-filial.dto';

@Controller('filiais')
export class FilialController {
  constructor(
    private readonly filialService: FilialService,
    private readonly logService: LogService,
  ) { }

  @Get('public/count')
  async getPublicCount() {
    const count = await this.filialService.countActive();
    return { count };
  }

  @Get('public/list')
  async findAllPublic() {
    return this.filialService.findAllPublic();
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Body() createFilialDto: CreateFilialDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const res = await this.filialService.create(createFilialDto, req.user.filial_id);
    await this.logService.logAction(
      'Criação',
      `Criou nova filial: ${res.nome}`,
      req.user.userId,
      'Filial',
    );
    return res;
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Request() req: AuthenticatedRequest, @Query('filialId') filialId?: string) {
    return this.filialService.findAll(
      filialId ? +filialId : undefined,
      req.user.filial_id,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.filialService.findOne(+id, req.user.filial_id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateFilialDto: UpdateFilialDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const res = await this.filialService.update(+id, updateFilialDto, req.user.filial_id);
    const acao = updateFilialDto.ativo === false ? 'Inativação' : 'Atualização';
    await this.logService.logAction(
      acao,
      `Atualizou dados da filial: ${res.nome}`,
      req.user.userId,
      'Filial',
    );
    return res;
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const filial = await this.filialService.findOne(+id, req.user.filial_id);
    const res = await this.filialService.remove(+id, req.user.filial_id);
    await this.logService.logAction(
      'Exclusão',
      `Excluiu filial: ${filial.nome}`,
      req.user.userId,
      'Filial',
    );
    return res;
  }
}
