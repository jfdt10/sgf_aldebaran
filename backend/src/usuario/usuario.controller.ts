import {
  Controller,
  Post,
  Body,
  Get,
  Put,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  Request,
  Query,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UsuarioService } from './usuario.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LogService } from '../log/log.service';
import { AuthenticatedRequest, AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import { AccountManagementGuard, StaffGuard, canManageAccounts } from '../auth/account-role.guards';
import { ChangeStaffPasswordDto, PasswordDto } from '../auth/password.dto';

@Controller('usuarios')
export class UsuarioController {
  constructor(
    private readonly usuarioService: UsuarioService,
    private readonly logService: LogService,
  ) {}

  @Post('login')
  login(@Body() body: { login: string; senha: string }) {
    return this.usuarioService.validarLogin(body.login, body.senha);
  }

  @UseGuards(JwtAuthGuard, AccountManagementGuard)
  @Post()
  async criarUsuario(@Body() body: any, @Request() req: AuthenticatedRequest) {
    this.assertAssignableRole(req.user, body.perfil);
    const res = await this.usuarioService.criar(body, req.user.filial_id);
    await this.logService.logAction(
      'Criação',
      `Criou usuário: ${res.nome}`,
      req.user.userId,
      'Usuário',
      'Sucesso',
      res.filial_id ?? undefined,
    );
    return res;
  }

  @UseGuards(JwtAuthGuard, AccountManagementGuard)
  @Get()
  findAll(@Query('filialId') filialId?: string, @Request() req?: AuthenticatedRequest) {
    return this.usuarioService.findAll(
      filialId ? +filialId : undefined,
      req?.user?.filial_id,
    );
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req: AuthenticatedRequest) {
    await this.assertAccountAccess(id, req.user, true);
    return this.usuarioService.findOne(id, req.user.filial_id);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @Request() req: AuthenticatedRequest,
  ) {
    await this.assertAccountAccess(id, req.user, true);
    const ownProfile = req.user.userId === id && req.user.perfil !== 'ADMIN';
    if (!ownProfile) this.assertAssignableRole(req.user, body.perfil);
    const { nome, email, login } = body;
    const changes = ownProfile ? { nome, email, login } : body;
    const res = await this.usuarioService.update(id, changes, req.user.filial_id);
    const userId = req.user.userId;
    await this.logService.logAction(
      'Atualização',
      `Atualizou usuário: ${res.nome}`,
      userId,
      'Usuário',
      'Sucesso',
      res.filial_id ?? undefined,
    );
    return res;
  }

  @UseGuards(JwtAuthGuard, AccountManagementGuard)
  @Patch(':id/status')
  async toggleStatus(@Param('id', ParseIntPipe) id: number, @Request() req: AuthenticatedRequest) {
    await this.assertAccountAccess(id, req.user);
    const res = await this.usuarioService.toggleStatus(id, req.user.filial_id);
    const userId = req.user.userId;
    const acao = res.ativo ? 'Ativação' : 'Inativação';
    await this.logService.logAction(
      acao,
      `Alterou status do usuário ID ${id}`,
      userId,
      'Usuário',
    );
    return res;
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Patch('me/senha')
  async changeMyPassword(@Body() body: ChangeStaffPasswordDto, @Request() req: AuthenticatedRequest) {
    await this.usuarioService.changeMyPassword(req.user.userId, body.senhaAtual, body.senha);
    await this.logService.logAction('Alteracao de senha', 'Usuario alterou a propria senha', req.user.userId, 'Autenticacao');
    return { updated: true };
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Patch(':id/senha')
  async resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PasswordDto,
    @Request() req: AuthenticatedRequest,
  ) {
    await this.assertAccountAccess(id, req.user, true);
    return this.usuarioService.resetPassword(id, body.senha, req.user.filial_id).then(async (res) => {
      const userId = req.user.userId;
      await this.logService.logAction(
        'Reset de Senha',
        `Resetou senha do usuário: ${res.nome}`,
        userId,
        'Usuário',
      );
      return res;
    });
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Post(':id/foto')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (req, file, callback) => {
        const user = (req as AuthenticatedRequest).user;
        if (String(user.userId) !== req.params.id) return callback(new ForbiddenException(), false);
        const format = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[file.mimetype];
        return callback(null, !!format && (format === extname(file.originalname).toLowerCase() ||
          (format === '.jpg' && extname(file.originalname).toLowerCase() === '.jpeg')));
      },
      storage: diskStorage({
        destination: './uploads/perfil',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `perfil-${req.params.id}-${uniqueSuffix}${ext}`);
        },
      }),
    }),
  )
  uploadFoto(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!file) throw new BadRequestException('Selecione uma imagem JPEG, PNG ou WebP.');
    const fotoUrl = `/uploads/perfil/${file.filename}`;
    return this.usuarioService.updateFoto(id, fotoUrl).then(async (res) => {
      const userId = req.user?.userId ?? req.user?.id;
      await this.logService.logAction(
        'Atualização',
        `Atualizou foto do usuário: ${res.nome}`,
        userId,
        'Usuário',
      );
      return res;
    });
  }
  
  @UseGuards(JwtAuthGuard, AccountManagementGuard)
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Request() req: AuthenticatedRequest) {
    await this.assertAccountAccess(id, req.user);
    const res = await this.usuarioService.softDelete(id, req.user.filial_id);
    const userId = req.user.userId;
    const nome = res?.nome ? res.nome : `ID ${id}`;
    await this.logService.logAction(
      'Exclusão',
      `Excluiu usuário: ${nome}`,
      userId,
      'Usuário',
    );
    return res;
  }

  private async assertAccountAccess(id: number, actor: AuthenticatedUser, allowSelf = false) {
    if (allowSelf && actor.userId === id) return;
    if (!canManageAccounts(actor)) throw new ForbiddenException();
    if (actor.perfil !== 'ADMIN') {
      const target = await this.usuarioService.findOne(id, actor.filial_id);
      if (target.perfil.toUpperCase() === 'ADMIN') throw new ForbiddenException();
    }
  }

  private assertAssignableRole(actor: AuthenticatedUser, role: unknown) {
    if (role === undefined) return;
    const allowed = actor.perfil === 'ADMIN' ? ['ADMIN', 'SUPERVISOR', 'OPERADOR'] : ['SUPERVISOR', 'OPERADOR'];
    if (typeof role !== 'string' || !allowed.includes(role)) throw new ForbiddenException();
  }
}
