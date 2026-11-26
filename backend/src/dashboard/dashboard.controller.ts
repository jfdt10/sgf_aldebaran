import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccountManagementGuard } from '../auth/account-role.guards';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, AccountManagementGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('metrics')
  getMetrics(@Request() req: AuthenticatedRequest, @Query('filialId') filialId: string) {
    return this.dashboardService.getMetrics((req.user.filial_id?.toString() ?? filialId));
  }

  @Get('relatorios')
  getRelatorios(@Request() req: AuthenticatedRequest,
    @Query('periodo') periodo: string,
    @Query('filialId') filialId: string,
  ) {
    return this.dashboardService.getRelatorios(periodo || 'mes', (req.user.filial_id?.toString() ?? filialId));
  }

  @Get('supervisor')
  getSupervisorOverview(@Request() req: AuthenticatedRequest,
    @Query('filialId') filialId: string,
    @Query('data') data?: string,
  ) {
    return this.dashboardService.getSupervisorOverview((req.user.filial_id?.toString() ?? filialId), data);
  }

  @Get('graficos-por-hora')
  getGraficosPorHora(@Request() req: AuthenticatedRequest,
    @Query('periodo') periodo: string,
    @Query('filialId') filialId: string,
  ) {
    return this.dashboardService.getGraficosPorHora(periodo || 'dia', (req.user.filial_id?.toString() ?? filialId));
  }

  @Get('operadores')
  getDesempenhoOperadores(@Request() req: AuthenticatedRequest,
    @Query('periodo') periodo: string,
    @Query('filialId') filialId: string,
  ) {
    return this.dashboardService.getDesempenhoOperadores(periodo || 'dia', (req.user.filial_id?.toString() ?? filialId));
  }

  @Get('meses-disponiveis')
  getMesesDisponiveis(@Request() req: AuthenticatedRequest, @Query('filialId') filialId: string) {
    return this.dashboardService.getMesesDisponiveis((req.user.filial_id?.toString() ?? filialId));
  }

  @Get('fila-espera')
  getFilaEspera(@Request() req: AuthenticatedRequest, @Query('filialId') filialId: string) {
    return this.dashboardService.getFilaEspera((req.user.filial_id?.toString() ?? filialId));
  }
}
