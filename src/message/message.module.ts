import { Module } from '@nestjs/common'

import { PrismaService } from '@/prisma.service'
import { UserService } from '@/user/user.service'

import { MessageController } from './message.controller'
import { MessageGateway } from './message.gateway'
import { MessageService } from './message.service'

@Module({
  controllers: [MessageController],
  providers: [MessageGateway, MessageService, PrismaService, UserService]
})
export class MessageModule {}
