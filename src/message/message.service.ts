import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { EnumMessageStatus } from '@prisma/__generated__/enums'
import { plainToInstance } from 'class-transformer'

import { ChatService } from '@/chat/chat.service'
import { PaginatedResponse } from '@/chat/dto'
import { PrismaService } from '@/prisma.service'

import { CreateMessageDto, MessageFilterDto, MessageResponseDto } from './dto'

@Injectable()
export class MessageService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly chatService: ChatService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  //#region gateway methods

  async create(
    userId: string,
    createMessageDto: CreateMessageDto
  ): Promise<MessageResponseDto> {
    const { chatId, content, replyToId, forwardedFromId } = createMessageDto

    const isMember = await this.chatService.isChatMember(chatId, userId)
    if (!isMember) {
      throw new ForbiddenException('Вы не являетесь участником этого чата')
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
    const participantIds = chatMembers.map(m => m.userId)

    const message = await this.prismaService.$transaction(
      async prismaService => {
        const mainMessage = await prismaService.message.create({
          data: {
            chatId,
            senderId: userId,
            content,
            replyToId,
            forwardedFromId
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

        const newMessage = await this.connectReplyToOrForwardedFrom(mainMessage)

        await prismaService.messageStatus.createMany({
          data: chatMembers.map(member => ({
            messageId: newMessage.id,
            userId: member.userId,
            status:
              member.userId === userId
                ? EnumMessageStatus.READ
                : EnumMessageStatus.SENT
          }))
        })

        await prismaService.chat.update({
          where: { id: chatId },
          data: { lastMessageId: newMessage.id }
        })

        return newMessage
      }
    )

    const messageDto = this.mapToResponseDto(message)

    // Эмитим событие о новом сообщении
    this.eventEmitter.emit('message.created', {
      message: messageDto,
      chatId,
      participantIds,
      senderId: userId
    })

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
    await this.prismaService.messageStatus.updateMany({
      where: {
        userId,
        status: { in: [EnumMessageStatus.SENT, EnumMessageStatus.DELIVERED] },
        message: {
          chatId,
          senderId: { not: userId }
        },
        ...(messageIds && { messageId: { in: messageIds } })
      },
      data: { status: EnumMessageStatus.READ }
    })
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

    const { page = 1, limit = 50, fromDate, search } = filter
    const skip = (page - 1) * limit

    const messagesPromise = this.prismaService.message
      .findMany({
        where: {
          chatId,
          isSystem: false,
          deletedAt: null,
          ...(fromDate && { createdAt: new Date(fromDate) }),
          ...(search && {
            content: { contains: search, mode: 'insensitive' }
          })
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
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

    const totalPages = Math.ceil(total / limit)
    const hasNextPage = page < totalPages
    const hasPreviousPage = page > 1

    const data = messages.map(msg => this.mapToResponseDto(msg))

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPreviousPage
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

  //#region private methods

  private async connectReplyToOrForwardedFrom(mainMessage) {
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
      : {}

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
      : {}

    if (replyTo && forwardedFrom)
      throw new ForbiddenException(
        'Сообщение не может быть пересланным и ответом одновременно'
      )

    const message = { ...mainMessage, replyTo, forwardedFrom }

    return message
  }

  private mapToResponseDto(message: any): MessageResponseDto {
    const statuses = message.statuses?.reduce(
      (acc, status) => {
        acc[status.userId] = status.status
        return acc
      },
      {} as Record<string, EnumMessageStatus>
    )

    return plainToInstance(
      MessageResponseDto,
      {
        ...message,
        statuses,
        isEdited: message.updatedAt > message.createdAt
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
