import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../common/current-user.decorator';
import { SimulatorService } from './simulator.service';
import { AffordCheckDto } from './dto/afford-check.dto';

@UseGuards(JwtAuthGuard)
@Controller('simulator')
export class SimulatorController {
  constructor(private readonly simulatorService: SimulatorService) {}

  @Post('afford-check')
  affordCheck(@CurrentUser() user: RequestUser, @Body() dto: AffordCheckDto) {
    return this.simulatorService.affordCheck(user.userId, dto);
  }
}
