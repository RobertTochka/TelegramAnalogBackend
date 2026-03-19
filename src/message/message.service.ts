import {
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Prisma } from '@prisma/__generated__/client'
import { EnumMessageStatus } from '@prisma/__generated__/enums'
import { plainToInstance } from 'class-transformer'

import { ChatService } from '@/chat/chat.service'
import { PaginatedResponse } from '@/chat/dto'
import { PrismaService } from '@/prisma.service'

import { CreateMessageDto, MessageFilterDto, MessageResponseDto } from './dto'

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name)

  constructor(
    private readonly prismaService: PrismaService,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  //#region gateway methods

  async create(
    userId: string,
    createMessageDto: CreateMessageDto
  ): Promise<MessageResponseDto> {
    const {
      chatId,
      content,
      replyToId,
      forwardedFromId,
      media,
      isSystem = false
    } = createMessageDto

    // Проверка членства в чате
    const isMember = await this.chatService.isChatMember(chatId, userId)
    if (!isMember) {
      throw new ForbiddenException('Вы не являетесь участником этого чата')
    }

    // Проверка прав для канала
    const isChannel = await this.chatService.isChannel(chatId)
    if (isChannel) {
      await this.chatService.checkAdminPermission(chatId, userId)
    }

    // Проверка существования сообщения для ответа
    if (replyToId) {
      const replyMessage = await this.prismaService.message.findUnique({
        where: { id: replyToId, deletedAt: null }
      })
      if (!replyMessage) {
        throw new NotFoundException(
          'Сообщение, на которое вы отвечаете, не найдено'
        )
      }
    }

    // Проверка существования сообщения для пересылки
    if (forwardedFromId) {
      const forwardedMessage = await this.prismaService.message.findUnique({
        where: { id: forwardedFromId, deletedAt: null }
      })
      if (!forwardedMessage) {
        throw new NotFoundException('Пересылаемое сообщение не найдено')
      }
    }

    // Получаем всех участников чата для создания статусов
    const chatMembers = await this.prismaService.chatMember.findMany({
      where: { chatId },
      select: { userId: true }
    })

    // Создаем сообщение в транзакции
    const message = await this.prismaService.$transaction(async prisma => {
      const mainMessage = await prisma.message.create({
        data: {
          chatId,
          senderId: userId,
          content,
          replyToId,
          forwardedFromId,
          isSystem,
          media: media?.length
            ? {
                create: media.map(file => ({
                  type: file.type,
                  url: file.url,
                  fileName: file.fileName,
                  fileSize: file.fileSize,
                  safeName: file.safeName
                }))
              }
            : undefined,
          statuses: {
            create: chatMembers.map(member => ({
              userId: member.userId,
              status: EnumMessageStatus.DELIVERED
            }))
          }
        },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true
            }
          },
          replyTo: true,
          media: true,
          statuses: true
        }
      })

      // Получаем полную цепочку пересылаемых сообщений
      const fullMessage = await this.loadForwardChain(mainMessage)

      // Обновляем lastMessage в чате
      await prisma.chat.update({
        where: { id: chatId },
        data: { lastMessageId: fullMessage.id }
      })

      return fullMessage
    })

    const msg = this.mapToResponseDto(message)

    return msg
  }

  async findOne(
    messageId: string,
    userId: string
  ): Promise<MessageResponseDto> {
    const message = await this.prismaService.message.findUnique({
      where: {
        id: messageId,
        deletedAt: null
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        },
        replyTo: true,
        media: true,
        statuses: {
          where: { userId },
          select: { status: true }
        }
      }
    })

    if (!message) {
      throw new NotFoundException('Сообщение не найдено')
    }

    // Проверка доступа к чату
    const isMember = await this.chatService.isChatMember(message.chatId, userId)
    if (!isMember) {
      throw new ForbiddenException('У вас нет доступа к этому сообщению')
    }

    // Загружаем цепочку пересланных сообщений
    const fullMessage = await this.loadForwardChain(message)

    return this.mapToResponseDto(fullMessage)
  }

  async update(
    messageId: string,
    userId: string,
    content: string
  ): Promise<MessageResponseDto> {
    const message = await this.prismaService.message.findUnique({
      where: {
        id: messageId,
        deletedAt: null
      }
    })

    if (!message) {
      throw new NotFoundException('Сообщение не найдено')
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException(
        'Вы можете редактировать только свои сообщения'
      )
    }

    const updatedMessage = await this.prismaService.message.update({
      where: { id: messageId },
      data: {
        isEdited: true,
        content: content,
        updatedAt: new Date()
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        },
        media: true
      }
    })

    return this.mapToResponseDto(updatedMessage)
  }

  async delete(
    messageId: string,
    userId: string,
    forEveryone: boolean = false
  ): Promise<void> {
    const message = await this.prismaService.message.findUnique({
      where: { id: messageId },
      include: {
        chat: {
          include: {
            admins: true
          }
        }
      }
    })

    if (!message) {
      throw new NotFoundException('Сообщение не найдено')
    }

    const isAdmin = message.chat.admins.some(admin => admin.userId === userId)
    const isOwner = message.senderId === userId

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('У вас нет прав на удаление этого сообщения')
    }

    if (forEveryone) {
      await this.prismaService.message.update({
        where: { id: messageId },
        data: { deletedAt: new Date() }
      })
    } else {
      await this.prismaService.messageStatus.update({
        where: {
          messageId_userId: {
            messageId,
            userId
          }
        },
        data: { status: EnumMessageStatus.DELETED }
      })
    }
  }

  async updateStatus(
    userId: string,
    messageId: string,
    status: EnumMessageStatus
  ): Promise<void> {
    const messageStatus = await this.prismaService.messageStatus.findUnique({
      where: {
        messageId_userId: {
          messageId,
          userId
        }
      }
    })

    if (!messageStatus) {
      throw new NotFoundException('Статус сообщения не найден')
    }

    await this.prismaService.messageStatus.update({
      where: {
        messageId_userId: {
          messageId,
          userId
        }
      },
      data: { status }
    })
  }

  async markAsRead(userId: string, chatId: string, messageIds?: string[]) {
    if (!messageIds || messageIds.length === 0) {
      const msgIds = await this.prismaService.messageStatus.findMany({
        where: {
          userId,
          status: { in: [EnumMessageStatus.SENT, EnumMessageStatus.DELIVERED] },
          message: {
            chatId,
            senderId: { not: userId },
            deletedAt: null
          }
        },
        select: {
          messageId: true
        }
      })

      messageIds = msgIds.map(m => m.messageId)
    }

    const messages = await this.prismaService.message.findMany({
      where: {
        id: { in: messageIds }
      },
      select: {
        id: true,
        sender: {
          select: {
            id: true
          }
        }
      }
    })

    const senders = [...new Set(messages.map(msg => msg.sender.id))]

    await this.prismaService.messageStatus.updateMany({
      where: {
        userId: { in: [userId, ...senders] },
        status: EnumMessageStatus.DELIVERED,
        message: {
          chatId
        },
        messageId: { in: messageIds }
      },
      data: { status: EnumMessageStatus.READ }
    })

    await this.prismaService.chatMember.update({
      where: {
        chatId_userId: {
          chatId,
          userId
        }
      },
      data: { lastReadAt: new Date() }
    })

    return messages
  }

  //#region controller methods

  async getChatMessages(
    userId: string,
    chatId: string,
    filter: MessageFilterDto
  ): Promise<PaginatedResponse<MessageResponseDto[]>> {
    const { limit = 50, fromDate, search, cursor } = filter

    const where: Prisma.MessageWhereInput = {
      chatId,
      deletedAt: null,
      ...(fromDate && { createdAt: { gte: new Date(fromDate) } }),
      ...(search && {
        content: { contains: search, mode: 'insensitive' }
      })
    }

    const messagesPromise = this.prismaService.message
      .findMany({
        where,
        take: limit,
        ...(cursor && {
          skip: 1,
          cursor: { id: cursor }
        }),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true
            }
          },
          replyTo: true,
          media: true,
          statuses: {
            where: { userId },
            select: {
              userId: true,
              status: true
            }
          }
        }
      })
      .then(messages =>
        Promise.all(messages.map(msg => this.loadForwardChain(msg)))
      )

    const countPromise = this.prismaService.message.count({ where })

    const [messages, total] = await Promise.all([messagesPromise, countPromise])

    // Помечаем сообщения как доставленные
    await this.markMessagesAsDelivered(
      userId,
      messages.map(m => m.id)
    )

    const data = messages.map(msg => this.mapToResponseDto(msg))

    const nextCursor =
      messages.length === limit ? messages[messages.length - 1].id : null

    return {
      data,
      meta: {
        total,
        limit,
        nextCursor,
        hasNextPage: !!nextCursor
      }
    }
  }

  async getUnreadCount(
    userId: string,
    chatId?: string
  ): Promise<number | Record<string, number>> {
    if (chatId) {
      return this.prismaService.messageStatus.count({
        where: {
          userId,
          status: { in: [EnumMessageStatus.SENT, EnumMessageStatus.DELIVERED] },
          message: {
            chatId,
            senderId: { not: userId },
            deletedAt: null
          }
        }
      })
    }

    // Получаем количество непрочитанных по всем чатам
    const unreadByChat = await this.prismaService.messageStatus.groupBy({
      by: ['messageId'],
      where: {
        userId,
        status: { in: [EnumMessageStatus.SENT, EnumMessageStatus.DELIVERED] },
        message: {
          senderId: { not: userId },
          deletedAt: null
        }
      },
      _count: {
        messageId: true
      }
    })

    // Получаем все чаты пользователя, чтобы включить чаты с 0 непрочитанных
    const userChats = await this.prismaService.chat.findMany({
      where: {
        OR: [
          { members: { some: { userId } } },
          { admins: { some: { userId } } }
        ],
        deletedAt: null
      },
      select: { id: true }
    })

    const result: Record<string, number> = {}

    // Инициализируем все чаты с 0
    userChats.forEach(chat => {
      result[chat.id] = 0
    })

    // Заполняем реальные значения непрочитанных сообщений
    // Сначала получаем все messageId и группируем их по chatId
    const messageIds = unreadByChat.map(item => item.messageId)

    if (messageIds.length > 0) {
      const messagesWithChats = await this.prismaService.message.findMany({
        where: {
          id: { in: messageIds }
        },
        select: {
          id: true,
          chatId: true
        }
      })

      // Создаем мапу messageId -> chatId
      const messageToChatMap = new Map(
        messagesWithChats.map(msg => [msg.id, msg.chatId])
      )

      // Подсчитываем количество непрочитанных по каждому чату
      unreadByChat.forEach(item => {
        const chatId = messageToChatMap.get(item.messageId)
        if (chatId) {
          result[chatId] = (result[chatId] || 0) + item._count.messageId
        }
      })
    }

    return result
  }

  async searchMessages(
    userId: string,
    query: string,
    chatId?: string
  ): Promise<MessageResponseDto[]> {
    const messages = await this.prismaService.message.findMany({
      where: {
        deletedAt: null,
        content: { contains: query, mode: 'insensitive' },
        ...(chatId && { chatId }),
        chat: {
          members: {
            some: { userId }
          }
        }
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        },
        chat: {
          select: {
            id: true,
            name: true,
            type: true
          }
        },
        media: true
      }
    })

    return messages.map(msg => this.mapToResponseDto(msg))
  }

  async createSystemMessage(chatId: string, userId: string, content: string) {
    const message = await this.create(userId, {
      chatId,
      content,
      isSystem: true
    })

    this.eventEmitter.emit('message.system.created', {
      chatId,
      message
    })

    return message
  }

  //#region private methods

  private async loadForwardChain(
    message: any,
    depth: number = 0
  ): Promise<any> {
    const MAX_DEPTH = 10

    if (!message.forwardedFromId || depth >= MAX_DEPTH) {
      return message
    }

    const forwardedMessage = await this.prismaService.message.findUnique({
      where: { id: message.forwardedFromId, deletedAt: null },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        },
        media: true
      }
    })

    if (!forwardedMessage) {
      return message
    }

    // Рекурсивно загружаем следующее сообщение в цепочке
    const forwardedWithChain = await this.loadForwardChain(
      forwardedMessage,
      depth + 1
    )

    return {
      ...message,
      forwardedFrom: forwardedWithChain
    }
  }

  private mapToResponseDto(message: any): MessageResponseDto {
    const statuses = message.statuses?.reduce(
      (acc, status) => {
        acc[status.userId] = status.status
        return acc
      },
      {} as Record<string, EnumMessageStatus>
    )

    const viewsCount =
      message.statuses?.filter(
        (status: any) => status.status === EnumMessageStatus.READ
      ).length || 0

    return plainToInstance(
      MessageResponseDto,
      {
        id: message.id,
        chatId: message.chatId,
        sender: message.sender,
        content: message.content,
        isSystem: message.isSystem,
        replyTo: message.replyTo,
        forwardedFrom: message.forwardedFrom,
        media: message.media || [],
        statuses,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        isEdited: message.updatedAt > message.createdAt,
        viewsCount
      },
      {
        excludeExtraneousValues: true
      }
    )
  }

  private async markMessagesAsDelivered(
    userId: string,
    messageIds: string[]
  ): Promise<void> {
    await this.prismaService.messageStatus.updateMany({
      where: {
        messageId: { in: messageIds },
        userId,
        status: EnumMessageStatus.SENT,
        message: {
          senderId: { not: userId }
        }
      },
      data: { status: EnumMessageStatus.DELIVERED }
    })
  }
}
