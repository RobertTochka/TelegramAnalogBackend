import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors
} from '@nestjs/common'

import { Authorization, Authorized } from '@/auth/decorators'
import { FileService } from '@/file/file.service'
import { UploadMessage } from '@/user/interceptors'

import { MessageFilterDto } from './dto'
import { MessageService } from './message.service'

@Controller('messages')
export class MessageController {
  constructor(
    private readonly messageService: MessageService,
    private readonly fileService: FileService
  ) {}

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

  @Authorization()
  @UseInterceptors(UploadMessage())
  @Post('files/:chatId')
  async uploadMessageFiles(
    @Authorized('id') userId: string,
    @Param('chatId') chatId: string,
    @UploadedFiles() files: Express.Multer.File[]
  ) {
    if (!files || files.length === 0)
      throw new BadRequestException('Файл не загружен')

    return this.fileService.uploadMessageFiles(files, userId, chatId)
  }
}
