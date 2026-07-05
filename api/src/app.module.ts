import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AccountsModule } from './accounts/accounts.module';
import { CategoriesModule } from './categories/categories.module';
import { CategorizationModule } from './categorization/categorization.module';
import { BankIntegrationModule } from './bank-integration/bank-integration.module';
import { TransactionsModule } from './transactions/transactions.module';
import { BudgetsModule } from './budgets/budgets.module';
import { GoalsModule } from './goals/goals.module';
import { ReportsModule } from './reports/reports.module';
import { InsightsModule } from './insights/insights.module';
import { SimulatorModule } from './simulator/simulator.module';
import { PlannerModule } from './planner/planner.module';
import { AlertsModule } from './alerts/alerts.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    AccountsModule,
    CategoriesModule,
    CategorizationModule,
    BankIntegrationModule,
    TransactionsModule,
    BudgetsModule,
    GoalsModule,
    ReportsModule,
    InsightsModule,
    SimulatorModule,
    PlannerModule,
    AlertsModule,
    HealthModule,
  ],
})
export class AppModule {}
