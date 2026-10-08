import { Module } from '@nestjs/common';

import { RealtimeService } from './realtime.service';

/** Socket.IO on the API's HTTP server (spec 06 → Realtime). */
@Module({
  providers: [RealtimeService],
})
export class RealtimeModule {}
