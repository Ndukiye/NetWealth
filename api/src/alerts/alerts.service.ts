import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AI_ADVISOR, AiAdvisor } from '../insights/advisor.interface';
import { ALERT_CHANNEL, AlertChannel } from './alert-channel.interface';
import { UpdateAlertSettingsDto } from './dto/update-alert-settings.dto';

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_ADVISOR) private readonly advisor: AiAdvisor,
    @Inject(ALERT_CHANNEL) private readonly channel: AlertChannel,
  ) {}

  async getSettings(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { alertsEnabled: true, telegramChatId: true },
    });
  }

  async updateSettings(userId: string, dto: UpdateAlertSettingsDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: { alertsEnabled: true, telegramChatId: true },
    });
  }

  async listRecent(userId: string) {
    return this.prisma.alert.findMany({
      where: { userId },
      orderBy: { sentAt: 'desc' },
      take: 20,
    });
  }

  /** Called after a bank sync (scheduled or webhook) to fan out alerts to everyone who's opted in. */
  async checkAndDispatchForAllUsers() {
    const users = await this.prisma.user.findMany({
      where: { alertsEnabled: true, telegramChatId: { not: null } },
      select: { id: true },
    });
    let totalSent = 0;
    for (const user of users) {
      const result = await this.checkAndDispatch(user.id);
      totalSent += result.sent;
    }
    return { usersChecked: users.length, alertsSent: totalSent };
  }

  async sendTest(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.telegramChatId) {
      throw new BadRequestException('Add a Telegram chat ID in settings first');
    }
    const message = `NetWealth test alert — spending alerts are wired up correctly for ${user.fullName}.`;
    return this.dispatch(userId, user.telegramChatId, message, null);
  }

  /**
   * Runs the same insight engine behind the dashboard, and pushes any new
   * warning-level insight (budget over/near limit, spending spike) out as an
   * alert — skipping anything already alerted today so this can be called
   * repeatedly (e.g. after every bank sync) without spamming the user.
   */
  async checkAndDispatch(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.alertsEnabled || !user.telegramChatId) {
      return { sent: 0, reason: 'alerts disabled or no destination configured' };
    }

    const snapshot = await this.advisor.analyze(userId);
    const warnings = snapshot.insights.filter((i) => i.severity === 'warning');
    if (warnings.length === 0) return { sent: 0 };

    const alertedToday = await this.prisma.alert.findMany({
      where: { userId, sentAt: { gte: startOfToday() } },
      select: { insightId: true },
    });
    const alreadySent = new Set(alertedToday.map((a) => a.insightId));

    let sent = 0;
    for (const insight of warnings) {
      if (alreadySent.has(insight.id)) continue;
      await this.dispatch(userId, user.telegramChatId, `${insight.title}: ${insight.message}`, insight.id);
      sent += 1;
    }
    return { sent };
  }

  private async dispatch(userId: string, destination: string, message: string, insightId: string | null) {
    await this.channel.send(destination, message);
    return this.prisma.alert.create({
      data: { userId, channel: this.channel.name, message, insightId },
    });
  }
}
