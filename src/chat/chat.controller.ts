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
   * Присоединение к чату по пригласительной ссылке
   */
  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Get('join/:inviteLink')
  async joinByInviteLink(
    @Authorized('id') userId: string,
    @Param('inviteLink') inviteLink: string
  ) {
    return this.chatService.joinByInviteLink(inviteLink, userId)
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
  @Delete(':id')
  async remove(@Authorized('id') userId: string, @Param('id') id: string) {
    await this.chatService.remove(id, userId)
  }

  /**
   * Добавление участников в чат
   */
  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Post(':id/participants')
  async addParticipants(
    @Authorized('id') userId: string,
    @Param('id') id: string,
    @Body() pdarticipantIds: string[]
  ) {
    return this.chatService.addParticipants(id, userId, pdarticipantIds)
  }

  /**
   * Удаление участников из чата
   */
  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Delete(':id/participants')
  async removeParticipants(
    @Authorized('id') userId: string,
    @Param('id') id: string,
    @Body() participantIds: string[]
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
    @Body() newAdminId: string
  ) {
    return this.chatService.addAdmin(id, userId, newAdminId)
  }

  /**
   * Снятие администратора
   */
  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Delete(':id/admins/:adminId')
  async removeAdmin(
    @Authorized('id') userId: string,
    @Param('id') id: string,
    @Param('adminId') adminId: string
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
  async pin(
    @Authorized('id') userId: string,
    @Param('id') id: string,
    @Body() pin: boolean
  ) {
    return this.chatService.pin(id, pin, userId)
  }

  /**
   * Создание пригласительной ссылки
   */
  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Post(':id/invite')
  async createInviteLink(
    @Authorized('id') userId: string,
    @Param('id') id: string,
    @Body() expiresAt: Date
  ) {
    return this.chatService.createInviteLink(id, userId, expiresAt)
  }

  /**
   * Отметить сообщения как прочитанные
   */
  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Post(':id/read')
  async markAsRead(@Authorized('id') userId: string, @Param('id') id: string) {
    await this.chatService.updateLastReadAt(id, userId)
  }
}
