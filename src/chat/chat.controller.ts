import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query
} from '@nestjs/common'

import { Authorization, Authorized } from '@/auth/decorators'

import { ChatService } from './chat.service'
import { ChatFilterDto, CreateChatDto, UpdateChatDto } from './dto'

@Controller('chats')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * Создание нового чата
   */
  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Post()
  async create(
    @Authorized('id') userId: string,
    @Body() createChatDto: CreateChatDto
  ) {
    return this.chatService.create(userId, createChatDto)
  }

  /**
   * Получение всех чатов пользователя
   */
  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Get()
  async findAll(
    @Authorized('id') userId: string,
    @Query() filter: ChatFilterDto
  ) {
    return this.chatService.findAll(userId, filter)
  }

  /**
   * Получение количества непрочитанных сообщений по всем чатам
   */
  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Get('unread')
  async getUnreadCounts(@Authorized('id') userId: string) {
    return this.chatService.getUnreadCounts(userId)
  }

  /**
   * Получение чата по ID
   */
  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Get(':id')
  async findOne(@Authorized('id') userId: string, @Param('id') id: string) {
    return this.chatService.findOne(id, userId)
  }

  /**
   * Получение количества непрочитанных сообщений в чате
   */
  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Get(':id/unread')
  async getUnreadCount(
    @Authorized('id') userId: string,
    @Param('id') id: string
  ) {
    return this.chatService.getUnreadCount(id, userId)
  }

  /**
   * Обновление чата
   */
  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Put(':id')
  async update(
    @Authorized('id') userId: string,
    @Param('id') id: string,
    @Body() updateChatDto: UpdateChatDto
  ) {
    return this.chatService.update(id, userId, updateChatDto)
  }

  /**
   * Удаление чата (только для владельца)
   */
  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Delete(':id/history')
  async remove(@Authorized('id') userId: string, @Param('id') id: string) {
    await this.chatService.remove(id, userId)
  }

  /**
   * Очистка истории
   */
  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Delete(':id')
  async clearHistory(
    @Authorized('id') userId: string,
    @Param('id') id: string
  ) {
    await this.chatService.clearHistory(id, userId)
  }

  /**
   * Добавление участников в чат
   */
  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Put(':id/participants')
  async addParticipants(
    @Authorized('id') userId: string,
    @Param('id') id: string,
    @Body() { participantIds }: { participantIds: string[] }
  ) {
    return this.chatService.addParticipants(id, userId, participantIds)
  }

  /**
   * Удаление участников из чата
   */
  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Post(':id/participants')
  async removeParticipants(
    @Authorized('id') userId: string,
    @Param('id') id: string,
    @Body() { participantIds }: { participantIds: string[] }
  ) {
    await this.chatService.removeParticipants(id, userId, participantIds)
  }

  /**
   * Выход из чата
   */
  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Post(':id/leave')
  async leave(@Authorized('id') userId: string, @Param('id') id: string) {
    return this.chatService.leave(id, userId)
  }

  /**
   * Назначение администратора
   */
  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Post(':id/admins')
  async addAdmin(
    @Authorized('id') userId: string,
    @Param('id') id: string,
    @Body() { newAdminId }: { newAdminId: string }
  ) {
    return this.chatService.addAdmin(id, userId, newAdminId)
  }

  /**
   * Снятие администратора
   */
  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Delete(':id/admins')
  async removeAdmin(
    @Authorized('id') userId: string,
    @Param('id') id: string,
    @Body() adminId: string
  ) {
    return this.chatService.removeAdmin(id, userId, adminId)
  }

  /**
   * Архивирование/разархивирование чата
   */
  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Post(':id/archive')
  async archive(
    @Authorized('id') userId: string,
    @Param('id') id: string,
    @Body() archive: boolean
  ) {
    return this.chatService.archive(id, archive, userId)
  }

  /**
   * Заглушение/включение звука чата
   */
  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Post(':id/mute')
  async mute(
    @Authorized('id') userId: string,
    @Param('id') id: string,
    @Body() muteUntil: Date
  ) {
    return this.chatService.mute(id, muteUntil, userId)
  }

  /**
   * Закрепление/открепление чата
   */
  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Post(':id/pin')
  async pinChat(
    @Authorized('id') userId: string,
    @Param('id') id: string,
    @Body() { pin }: { pin: boolean }
  ) {
    return this.chatService.pin(id, pin, userId)
  }

  /**
   * Создание пригласительной ссылки
   */
  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Get(':id/invite-link')
  async createInviteLink(
    @Authorized('id') userId: string,
    @Param('id') id: string,
    @Body() expiresAt?: Date
  ) {
    return this.chatService.createInviteLink(id, userId, expiresAt)
  }

  /**
   * Присоединение к чату по пригласительной ссылке
   */
  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Post('join/:inviteLink')
  async joinByInviteLink(
    @Authorized('id') userId: string,
    @Param('inviteLink') inviteLink: string
  ) {
    return this.chatService.joinByInviteLink(inviteLink, userId)
  }

  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Post('join')
  async join(
    @Authorized('id') userId: string,
    @Body() { chatId }: { chatId: string }
  ) {
    return this.chatService.join(chatId, userId)
  }

  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Post(':chatId/messages/:messageId/pin')
  async pinMessage(
    @Authorized('id') userId: string,
    @Param('chatId') chatId: string,
    @Param('messageId') messageId: string
  ) {
    return this.chatService.pinMessage(chatId, messageId, userId)
  }

  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Delete(':chatId/messages/:messageId/pin')
  async unpinMessage(
    @Authorized('id') userId: string,
    @Param('chatId') chatId: string,
    @Param('messageId') messageId: string
  ) {
    return this.chatService.unpinMessage(chatId, messageId, userId)
  }
}
