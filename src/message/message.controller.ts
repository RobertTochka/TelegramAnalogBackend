import { Controller, Get, Param, Query } from '@nestjs/common'

import { Authorization, Authorized } from '@/auth/decorators'

import { MessageFilterDto } from './dto'
import { MessageService } from './message.service'

@Controller('messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Authorization()
  @Get(':chatId')
  async getChatMessages(
    @Authorized('id') userId: string,
    @Param('chatId') chatId: string,
    @Query() filter: MessageFilterDto
  ) {
    return this.messageService.getChatMessages(userId, chatId, filter)
  }

  @Authorization()
  @Get(':chatId/:messageId/position')
  async getMessagePosition(
    @Authorized('id') userId: string,
    @Param('chatId') chatId: string,
    @Param('messageId') messageId: string,
    @Query('limit') limit?: string
  ) {
    return this.messageService.getMessagePosition(
      userId,
      chatId,
      messageId,
      limit ? parseInt(limit, 10) : 40
    )
  }

  @Authorization()
  @Get('unread')
  async getUnreadCount(
    @Authorized('id') userId: string,
    @Query('chatId') chatId?: string
  ) {
    return this.messageService.getUnreadCount(userId, chatId)
  }

  @Authorization()
  @Get('search')
  async search(
    @Authorized('id') userId: string,
    @Query('q') query: string,
    @Query('chatId') chatId?: string
  ) {
    return this.messageService.searchMessages(userId, query, chatId)
  }
}
