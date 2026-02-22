import { Module } from '@nestjs/common';
import { BranchesModule } from 'src/branches/branches.module';
import { CashflowController } from './cashflow.controller';
import { CashflowService } from './cashflow.service';

@Module({
  imports: [BranchesModule],
  controllers: [CashflowController],
  providers: [CashflowService],
})
export class CashflowModule {}
