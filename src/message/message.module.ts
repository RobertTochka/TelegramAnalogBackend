import { forwardRef, Module } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'

import { ChatModule } from '@/chat/chat.module'
import { ChatService } from '@/chat/chat.service'
import { PrismaService } from '@/prisma.service'
import { UserService } from '@/user/user.service'

import { MessageController } from './message.controller'
import { MessageGateway } from './message.gateway'
import { MessageService } from './message.service'

@Module({
  imports: [forwardRef(() => ChatModule), EventEmitterModule.forRoot()],
  controllers: [MessageController],
  providers: [
    MessageService,
    PrismaService,
    ChatService,
    UserService,
    MessageGateway
  ]
})
export class MessageModule {}
