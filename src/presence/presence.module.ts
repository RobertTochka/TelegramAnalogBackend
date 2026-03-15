import { Module } from '@nestjs/common'

import { PrismaService } from '@/prisma.service'

import { PresenceGateway } from './presence.gateway'
import { PresenceService } from './presence.service'

@Module({
  providers: [PresenceGateway, PresenceService, PrismaService],
  exports: [PresenceService]
})
export class PresenceModule {}
