import { Module } from '@nestjs/common';
import { CategorizationModule } from '../categorization/categorization.module';
import { CategoriesModule } from '../categories/categories.module';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';

@Module({
  imports: [CategorizationModule, CategoriesModule],
  providers: [TransactionsService],
  controllers: [TransactionsController],
})
export class TransactionsModule {}
