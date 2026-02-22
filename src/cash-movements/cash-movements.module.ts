import { Module } from '@nestjs/common';
import { CashMovementsController } from './cash-movements.controller';
import { CashMovementsService } from './cash-movements.service';
import { BranchesModule } from 'src/branches/branches.module';

@Module({
  imports: [BranchesModule],
  controllers: [CashMovementsController],
  providers: [CashMovementsService],
})
export class CashMovementsModule {}
