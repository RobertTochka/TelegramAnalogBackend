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
import { MessagePositionResponseDto } from './dto/message-position-response.dto '

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
      isSystem = false
    } = createMessageDto

    const isMember = await this.chatService.isChatMember(chatId, userId)
    if (!isMember) {
      throw new ForbiddenException('Вы не являетесь участником этого чата')
    }
    const isChannel = await this.chatService.isChannel(chatId)

    if (isChannel) {
      await this.chatService.checkAdminPermission(chatId, userId)
    }

    if (replyToId) {
      const replyMessage = await this.prismaService.message.findUnique({
        where: { id: replyToId }
      })
      if (!replyMessage) {
        throw new NotFoundException(
          'Сообщение, на которое вы отвечаете, не найдено'
        )
      }
    }

    const chatMembers = await this.prismaService.chatMember.findMany({
      where: { chatId },
      select: { userId: true }
    })

    const message = await this.prismaService.$transaction(
      async prismaService => {
        const mainMessage = await prismaService.message.create({
          data: {
            chatId,
            senderId: userId,
            content,
            replyToId,
            forwardedFromId,
            isSystem,
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
            media: true,
            statuses: true
          }
        })

        const newMessage = await this.connectReplyToOrForwardedFrom(mainMessage)

        await prismaService.chat.update({
          where: { id: chatId },
          data: { lastMessageId: newMessage.id }
        })

        return newMessage
      }
    )

    const messageDto = this.mapToResponseDto(message)

    return messageDto
  }

  async findOne(
    messageId: string,
    userId: string
  ): Promise<MessageResponseDto> {
    const mainMessage = await this.prismaService.message.findUnique({
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
        media: true,
        statuses: {
          where: { userId },
          select: { status: true }
        }
      }
    })

    if (!mainMessage) {
      throw new NotFoundException('Сообщение не найдено')
    }

    const message = await this.connectReplyToOrForwardedFrom(mainMessage)

    const isMember = await this.chatService.isChatMember(message.chatId, userId)
    if (!isMember) {
      throw new ForbiddenException('У вас нет доступа к этому сообщению')
    }

    return this.mapToResponseDto(message)
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
    const isMember = await this.chatService.isChatMember(chatId, userId)
    if (!isMember) {
      throw new ForbiddenException('Вы не являетесь участником этого чата')
    }

    const { limit = 50, fromDate, search, cursor } = filter

    const messagesPromise = this.prismaService.message
      .findMany({
        where: {
          chatId,
          deletedAt: null,
          ...(fromDate && { createdAt: new Date(fromDate) }),
          ...(search && {
            content: { contains: search, mode: 'insensitive' }
          })
        },
        take: limit,
        ...(cursor && {
          skip: 1,
          cursor: {
            id: cursor
          }
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
        Promise.all(
          messages.map(msg => this.connectReplyToOrForwardedFrom(msg))
        )
      )

    const countPromise = this.prismaService.message.count({
      where: {
        chatId,
        deletedAt: null,
        ...(fromDate && { createdAt: new Date(fromDate) }),
        ...(search && {
          content: { contains: search, mode: 'insensitive' }
        })
      }
    })

    const [messages, total] = await Promise.all([messagesPromise, countPromise])

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

  async getMessagePosition(
    userId: string,
    chatId: string,
    messageId: string,
    limit: number = 40
  ): Promise<MessagePositionResponseDto> {
    const isMember = await this.chatService.isChatMember(chatId, userId)

    if (!isMember) {
      throw new ForbiddenException('Вы не являетесь участником этого чата')
    }

    const message = await this.prismaService.message.findFirst({
      where: {
        id: messageId,
        chatId,
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

    if (!message) {
      throw new NotFoundException('Сообщение не найдено')
    }

    const messagesBefore = await this.prismaService.message.count({
      where: {
        chatId,
        deletedAt: null,
        createdAt: { lt: message.createdAt }
      }
    })

    const totalCount = await this.prismaService.message.count({
      where: {
        chatId,
        deletedAt: null
      }
    })

    const page = Math.floor(messagesBefore / limit)

    const indexInPage = messagesBefore % limit

    const messageWithRelations =
      await this.connectReplyToOrForwardedFrom(message)

    const messageDto = this.mapToResponseDto({
      ...messageWithRelations,
      statuses: message.statuses
    })

    return {
      message: messageDto,
      page,
      indexInPage,
      totalBefore: messagesBefore,
      totalCount
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

  async connectReplyToOrForwardedFrom(mainMessage) {
    if (!mainMessage.replyToId && !mainMessage.forwardedFromId)
      return mainMessage

    const replyTo = mainMessage.replyToId
      ? await this.prismaService.message.findUnique({
          where: { id: mainMessage.replyToId },
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true
              }
            }
          }
        })
      : undefined

    const forwardedFrom = mainMessage.forwardedFromId
      ? await this.prismaService.message.findUnique({
          where: { id: mainMessage.forwardedFromId },
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true
              }
            }
          }
        })
      : undefined

    if (replyTo && forwardedFrom)
      throw new ForbiddenException(
        'Сообщение не может быть пересланным и ответом одновременно'
      )

    const message = { ...mainMessage, replyTo, forwardedFrom }

    return message
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
        ...message,
        statuses,
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
