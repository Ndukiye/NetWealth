import { Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../common/current-user.decorator';
import { FINANCIAL_PLANNER, FinancialPlanner } from './planner.interface';
import { BuildPlanDto } from './dto/build-plan.dto';
import { ChatDto } from './dto/chat.dto';

@UseGuards(JwtAuthGuard)
@Controller('planner')
export class PlannerController {
  constructor(@Inject(FINANCIAL_PLANNER) private readonly planner: FinancialPlanner) {}

  @Get('defaults')
  defaults(@CurrentUser() user: RequestUser) {
    return this.planner.defaults(user.userId);
  }

  @Get('review')
  review(@CurrentUser() user: RequestUser) {
    return this.planner.review(user.userId);
  }

  @Post('plan')
  buildPlan(@CurrentUser() user: RequestUser, @Body() dto: BuildPlanDto) {
    return this.planner.buildPlan(user.userId, dto);
  }

  @Post('chat')
  chat(@CurrentUser() user: RequestUser, @Body() dto: ChatDto) {
    return this.planner.chat(user.userId, dto.message);
  }
}
