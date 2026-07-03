import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../common/current-user.decorator';
import { AI_ADVISOR, AiAdvisor } from './advisor.interface';

@UseGuards(JwtAuthGuard)
@Controller('insights')
export class InsightsController {
  constructor(@Inject(AI_ADVISOR) private readonly advisor: AiAdvisor) {}

  @Get()
  analyze(@CurrentUser() user: RequestUser) {
    return this.advisor.analyze(user.userId);
  }
}
