import { forwardRef, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EventEmitterModule } from '@nestjs/event-emitter'

import { MessageModule } from '@/message/message.module'
import { PrismaService } from '@/prisma.service'
import { UserService } from '@/user/user.service'

import { ChatController } from './chat.controller'
import { ChatGateway } from './chat.gateway'
import { ChatService } from './chat.service'

@Module({
  imports: [forwardRef(() => MessageModule), EventEmitterModule.forRoot()],
  controllers: [ChatController],
  providers: [
    ChatService,
    PrismaService,
    ChatGateway,
    UserService,
    ConfigService
  ]
})
export class ChatModule {}
