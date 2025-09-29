import { Module } from '@nestjs/common';
import { NetSdkService, NetSdkController } from '.';

@Module({
  providers: [NetSdkService],
  controllers: [NetSdkController],
  exports: [NetSdkService],
})
export class NetSdkModule {}
