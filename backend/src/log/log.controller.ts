import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { LogService } from './log.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/account-role.guards';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@Controller('logs')
export class LogController {
  constructor(private readonly logService: LogService) {}

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get()
  findAll(@Query() query: any, @Request() req: AuthenticatedRequest) {
    return this.logService.findAll(query, req.user.filial_id);
  }

}
