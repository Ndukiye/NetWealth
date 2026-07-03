import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../common/current-user.decorator';
import { ReportsService } from './reports.service';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('net-worth')
  netWorth(@CurrentUser() user: RequestUser) {
    return this.reportsService.netWorth(user.userId);
  }

  @Get('cash-flow')
  cashFlow(@CurrentUser() user: RequestUser, @Query('months') months?: string) {
    return this.reportsService.cashFlow(user.userId, months ? Number(months) : undefined);
  }

  @Get('category-breakdown')
  categoryBreakdown(
    @CurrentUser() user: RequestUser,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    return this.reportsService.categoryBreakdown(user.userId, Number(month), Number(year));
  }
}
