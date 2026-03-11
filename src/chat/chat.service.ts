import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Prisma } from '@prisma/__generated__/client'
import { EnumChatType, EnumMemberRole } from '@prisma/__generated__/enums'
import { plainToInstance } from 'class-transformer'
import { v4 as uuidv4 } from 'uuid'

import { ms } from '@/libs/common/utils'
import { PrismaService } from '@/prisma.service'

import {
  ChatFilterDto,
  ChatResponseDto,
  CreateChatDto,
  PaginatedResponse,
  UpdateChatDto
} from './dto'

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)

  constructor(
    private prismaService: PrismaService,
    private eventEmitter: EventEmitter2
  ) {}

  /**
   * Создание нового чата
   */
  async create(
    userId: string,
    createChatDto: CreateChatDto
  ): Promise<ChatResponseDto> {
    const { type, name, description, participantIds, isPrivate, avatar } =
      createChatDto

    if (type === EnumChatType.DIRECT) {
      if (participantIds.length !== 1) {
        throw new BadRequestException(
          'Личный чат должен содержать ровно двух участников'
        )
      }

      const existingChat = await this.findDirectChat(userId, participantIds[0])
      if (existingChat) {
        return existingChat
      }
    }

    if (type === EnumChatType.CHANNEL) {
      if (!name) throw new BadRequestException('Ведите название канала')

      const userGroups = await this.findAll(userId, {
        type: EnumChatType.CHANNEL
      })

      // TODO: Сделать запрос на разрешение на создание канала
      if (userGroups.data.length >= 2)
        throw new ForbiddenException('Вы не можете создать более 2 каналов')
    }

    if (type === EnumChatType.GROUP) {
      if (!name) throw new BadRequestException('Ведите название чата')

      const userChats = await this.findAll(userId, {
        type: EnumChatType.GROUP
      })

      if (userChats.data.length >= 20)
        throw new ForbiddenException('Вы не можете создать более 20 чатов')
    }

    const allParticipantIds = [userId, ...participantIds]

    const chat = await this.prismaService.$transaction(async prisma => {
      const newChat = await this.prismaService.chat.create({
        data: {
          type,
          name,
          description,
          avatar,
          isPrivate: isPrivate || false,
          createdById: userId,
          ...(type === EnumChatType.GROUP && {
            inviteLink: this.generateInviteLink()
          })
        }
      })

      await this.prismaService.chatMember.createMany({
        data: allParticipantIds.map(participantId => ({
          chatId: newChat.id,
          userId: participantId,
          role:
            participantId === userId
              ? EnumMemberRole.OWNER
              : EnumMemberRole.MEMBER,
          joinedAt: new Date()
        }))
      })

      // Если это GROUP чат, создаем системное сообщение
      if (type === EnumChatType.GROUP) {
        await this.prismaService.message.create({
          data: {
            chatId: newChat.id,
            senderId: userId,
            isSystem: true,
            content: `Создал(а) чат "${name}"`
          }
        })
      }

      return newChat
    })

    const fullChat = await this.findOne(chat.id, userId)

    // Эмитим событие о новом чате для всех участников
    this.eventEmitter.emit('chat.created', {
      chatId: chat.id,
      chat: fullChat,
      participantIds: allParticipantIds,
      createdBy: userId
    })

    return fullChat
  }

  /**
   * Получение всех чатов пользователя
   */
  async findAll(
    userId: string,
    filter: ChatFilterDto
  ): Promise<PaginatedResponse<ChatResponseDto[]>> {
    const {
      type,
      isPrivate,
      isArchived,
      isMuted,
      search,
      cursor,
      limit = 20
    } = filter

    // Базовый WHERE для чатов пользователя
    const where: Prisma.ChatWhereInput = {
      members: {
        some: { userId }
      },
      ...(type && { type }),
      ...(isPrivate !== undefined && { isPrivate }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          {
            members: {
              some: {
                user: {
                  OR: [
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } },
                    { username: { contains: search, mode: 'insensitive' } }
                  ]
                }
              }
            }
          }
        ]
      })
    }

    if (isArchived !== undefined) {
      where.archivedBy = isArchived
        ? { some: { userId } }
        : { none: { userId } }
    }

    if (isMuted !== undefined) {
      where.mutedBy = isMuted ? { some: { userId } } : { none: { userId } }
    }

    const total = await this.prismaService.chat.count({ where })

    if (total === 0) {
      return {
        data: [],
        meta: {
          total: 0,
          limit,
          nextCursor: null,
          hasNextPage: false
        }
      }
    }

    let chats = await this.prismaService.chat.findMany({
      where,
      take: limit,
      ...(cursor && {
        skip: 1,
        cursor: {
          id: cursor
        }
      }),
      orderBy: [
        { pinnedChats: { _count: 'desc' } }, // Сначала закрепленные
        { updatedAt: 'desc' },
        { createdAt: 'desc' }
      ],
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                avatar: true,
                status: true,
                lastSeen: true
              }
            }
          }
        },
        archivedBy: {
          where: { userId },
          select: { archivedAt: true }
        },
        mutedBy: {
          where: { userId },
          select: { mutedUntil: true, mutedAt: true }
        },
        pinnedChats: {
          where: { userId },
          select: { pinnedAt: true }
        },
        _count: {
          select: {
            members: true,
            messages: {
              where: { deletedAt: null }
            }
          }
        }
      }
    })

    chats = await Promise.all(
      chats.map(async chat => {
        let enhancedChat = { ...chat }

        if (chat.lastMessageId) {
          enhancedChat = await this.connectLastMessageToChat(enhancedChat)
        }

        if (chat.pinnedMessageId) {
          enhancedChat = await this.connectPinnedMessageToChat(enhancedChat)
        }

        return enhancedChat
      })
    )

    const unreadCounts = await this.getUnreadCounts(userId)

    const data = chats.map(chat =>
      this.mapToResponseDto(chat, unreadCounts[chat.id] || 0)
    )

    const nextCursor =
      chats.length === limit ? chats[chats.length - 1].id : null

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

  /**
   * Получение одного чата
   */
  async findOne(chatId: string, userId: string): Promise<ChatResponseDto> {
    const chat = await this.prismaService.chat.findUnique({
      where: { id: chatId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                avatar: true,
                status: true,
                lastSeen: true
              }
            }
          }
        },
        createdBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        },
        archivedBy: {
          where: { userId },
          take: 1
        },
        mutedBy: {
          where: { userId },
          take: 1
        },
        pinnedChats: {
          where: { userId },
          take: 1
        },
        _count: {
          select: {
            members: true,
            messages: true
          }
        }
      }
    })

    let newChat = chat

    if (chat.lastMessageId)
      newChat = (await this.connectLastMessageToChat(chat)) as typeof chat

    if (chat.pinnedMessageId)
      newChat = (await this.connectPinnedMessageToChat(chat)) as typeof chat

    if (!newChat) {
      throw new NotFoundException('Чат не найден')
    }

    const isMember = newChat.members.some(member => member.userId === userId)
    if (!isMember) {
      throw new ForbiddenException('У вас нет доступа к этому чату')
    }

    const unreadCount = await this.getUnreadCount(chatId, userId)

    return this.mapToResponseDto(newChat, unreadCount)
  }

  /**
   * Обновление чата
   */
  async update(
    chatId: string,
    userId: string,
    updateChatDto: UpdateChatDto
  ): Promise<ChatResponseDto> {
    await this.checkAdminPermission(chatId, userId)

    // Создаем системное сообщение об изменении
    if (updateChatDto.name || updateChatDto.description) {
      await this.prismaService.message.create({
        data: {
          chatId,
          senderId: userId,
          isSystem: true,
          content: `Обновил(а) информацию чата`
        }
      })
    }

    return this.findOne(chatId, userId)
  }

  /**
   * Удаление чата (только для OWNER)
   */
  async remove(chatId: string, userId: string): Promise<void> {
    const chat = await this.prismaService.chat.findUnique({
      where: { id: chatId },
      include: {
        members: true
      }
    })

    if (!chat) {
      throw new NotFoundException('Чат не найден')
    }

    // Проверяем, что пользователь - владелец
    const member = chat.members.find(m => m.userId === userId)
    if (!member || member.role !== EnumMemberRole.OWNER) {
      throw new ForbiddenException('Только владелец может удалить чат')
    }

    const participantIds = chat.members.map(m => m.userId)

    await this.prismaService.chat.delete({
      where: { id: chatId }
    })

    // Эмитим событие об удалении чата
    this.eventEmitter.emit('chat.deleted', {
      chatId,
      participantIds,
      deletedBy: userId
    })
  }

  /**
   * Добавление участников в чат
   */
  async addParticipants(
    chatId: string,
    userId: string,
    participantIds: string[]
  ): Promise<ChatResponseDto> {
    await this.checkAdminPermission(chatId, userId)

    const existingMembers = await this.prismaService.chatMember.findMany({
      where: {
        chatId,
        userId: { in: participantIds }
      }
    })

    if (existingMembers.length > 0) {
      throw new ConflictException(
        'Некоторые пользователи уже являются участниками чата'
      )
    }

    await this.prismaService.chatMember.createMany({
      data: participantIds.map(participantId => ({
        chatId,
        userId: participantId,
        role: EnumMemberRole.MEMBER,
        joinedAt: new Date()
      }))
    })

    if (participantIds.length === 1) {
      const user = await this.prismaService.user.findUnique({
        where: {
          id: participantIds[0]
        },
        select: {
          firstName: true,
          lastName: true
        }
      })

      if (!user) throw new NotFoundException('Пользователь не найден')

      if (!user.firstName || !user.lastName) {
        await this.prismaService.message.create({
          data: {
            chatId,
            senderId: userId,
            isSystem: true,
            content: `Добавил(а) нового участника`
          }
        })
      } else {
        await this.prismaService.message.create({
          data: {
            chatId,
            senderId: userId,
            isSystem: true,
            content: `Добавил(а) нового участника: ${user.firstName} ${user.lastName}`
          }
        })
      }
    } else {
      await this.prismaService.message.create({
        data: {
          chatId,
          senderId: userId,
          isSystem: true,
          content: `Добавил(а) ${participantIds.length} новых участников`
        }
      })
    }

    const updatedChat = await this.findOne(chatId, userId)

    // Эмитим событие о добавлении новых участников
    this.eventEmitter.emit('chat.participants.added', {
      chatId,
      newParticipantIds: participantIds,
      addedBy: userId,
      chat: updatedChat
    })

    return updatedChat
  }

  /**
   * Удаление участников из чата
   */
  async removeParticipants(
    chatId: string,
    userId: string,
    participantIds: string[]
  ): Promise<ChatResponseDto> {
    await this.checkAdminPermission(chatId, userId)

    const owner = await this.prismaService.chatMember.findFirst({
      where: {
        chatId,
        role: EnumMemberRole.OWNER,
        userId: { in: participantIds }
      }
    })

    if (owner) {
      throw new ForbiddenException('Нельзя удалить владельца чата')
    }

    await this.prismaService.chatMember.deleteMany({
      where: {
        chatId,
        userId: { in: participantIds }
      }
    })

    if (participantIds.length === 1) {
      const user = await this.prismaService.user.findUnique({
        where: {
          id: participantIds[0]
        },
        select: {
          firstName: true,
          lastName: true
        }
      })

      if (!user) throw new NotFoundException('Пользователь не найден')

      if (!user.firstName || !user.lastName) {
        await this.prismaService.message.create({
          data: {
            chatId,
            senderId: userId,
            isSystem: true,
            content: `Удалил(а) участника`
          }
        })
      } else {
        await this.prismaService.message.create({
          data: {
            chatId,
            senderId: userId,
            isSystem: true,
            content: `Удалил(а) участника: ${user.firstName} ${user.lastName}`
          }
        })
      }
    } else {
      await this.prismaService.message.create({
        data: {
          chatId,
          senderId: userId,
          isSystem: true,
          content: `Удалил(а) ${participantIds.length} участников`
        }
      })
    }

    const updatedChat = await this.findOne(chatId, userId)

    // Эмитим событие об удалении участников
    this.eventEmitter.emit('chat.participants.removed', {
      chatId,
      removedParticipantIds: participantIds,
      removedBy: userId
    })

    return updatedChat
  }

  /**
   * Выход из чата
   */
  async leave(chatId: string, userId: string): Promise<void> {
    const chat = await this.prismaService.chat.findUnique({
      where: { id: chatId },
      include: {
        members: true
      }
    })

    if (!chat) {
      throw new NotFoundException('Чат не найден')
    }

    const member = chat.members.find(m => m.userId === userId)
    if (!member) {
      throw new ForbiddenException('Вы не являетесь участником чата')
    }

    if (
      member.role === EnumMemberRole.OWNER &&
      chat.type === EnumChatType.GROUP
    ) {
      const otherAdmins = chat.members.filter(
        m =>
          m.userId !== userId &&
          (m.role === EnumMemberRole.ADMIN || m.role === EnumMemberRole.OWNER)
      )

      if (otherAdmins.length > 0) {
        await this.prismaService.chatMember.update({
          where: {
            chatId_userId: {
              chatId,
              userId: otherAdmins[0].userId
            }
          },
          data: { role: EnumMemberRole.OWNER }
        })
      } else {
        throw new BadRequestException(
          'Нельзя выйти из чата, так как вы единственный администратор'
        )
      }
    }

    await this.prismaService.chatMember.delete({
      where: {
        chatId_userId: {
          chatId,
          userId
        }
      }
    })

    await this.prismaService.message.create({
      data: {
        chatId,
        senderId: userId,
        isSystem: true,
        content: `Покинул(а) чат`
      }
    })

    // Эмитим событие о выходе из чата
    this.eventEmitter.emit('chat.participant.left', {
      chatId,
      userId
    })
  }

  /**
   * Назначение администратора
   */
  async addAdmin(
    chatId: string,
    userId: string,
    newAdminId: string
  ): Promise<void> {
    await this.checkOwnerRole(chatId, userId)

    const member = await this.prismaService.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId: newAdminId
        }
      }
    })

    if (!member) {
      throw new NotFoundException('Пользователь не является участником чата')
    }

    if (member.role === EnumMemberRole.OWNER) {
      throw new BadRequestException('Владелец уже имеет все права')
    }

    await this.prismaService.$transaction(async prisma => {
      await this.prismaService.chatMember.update({
        where: {
          chatId_userId: {
            chatId,
            userId: newAdminId
          }
        },
        data: { role: EnumMemberRole.ADMIN }
      })

      await this.prismaService.chatAdmin.create({
        data: {
          chatId,
          userId: newAdminId
        }
      })
    })

    await this.prismaService.message.create({
      data: {
        chatId,
        senderId: userId,
        isSystem: true,
        content: `Назначил(а) администратора`
      }
    })
  }

  /**
   * Снятие администратора
   */
  async removeAdmin(
    chatId: string,
    userId: string,
    adminUserId: string
  ): Promise<void> {
    await this.checkOwnerRole(chatId, userId)

    const member = await this.prismaService.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId: adminUserId
        }
      }
    })

    if (!member || member.role !== EnumMemberRole.ADMIN) {
      throw new BadRequestException('Пользователь не является администратором')
    }

    await this.prismaService.$transaction(async prisma => {
      await this.prismaService.chatMember.update({
        where: {
          chatId_userId: {
            chatId,
            userId: adminUserId
          }
        },
        data: { role: EnumMemberRole.MEMBER }
      })

      await this.prismaService.chatAdmin.delete({
        where: {
          chatId_userId: {
            chatId,
            userId: adminUserId
          }
        }
      })
    })

    await this.prismaService.message.create({
      data: {
        chatId,
        senderId: userId,
        isSystem: true,
        content: `Снял(а) с должности администратора`
      }
    })
  }

  /**
   * Архивирование чата
   */
  async archive(
    chatId: string,
    archive: boolean = true,
    userId: string
  ): Promise<void> {
    if (archive) {
      await this.prismaService.archivedChat.upsert({
        where: {
          userId_chatId: {
            userId,
            chatId
          }
        },
        update: {},
        create: {
          userId,
          chatId
        }
      })
    } else {
      await this.prismaService.archivedChat.delete({
        where: {
          userId_chatId: {
            userId,
            chatId
          }
        }
      })
    }
  }

  /**
   * Заглушение чата
   */
  async mute(chatId: string, muteUntil: Date, userId: string): Promise<void> {
    if (muteUntil) {
      await this.prismaService.mutedChat.upsert({
        where: {
          userId_chatId: {
            userId,
            chatId
          }
        },
        update: {
          mutedUntil: new Date(muteUntil)
        },
        create: {
          userId,
          chatId,
          mutedUntil: new Date(muteUntil)
        }
      })
    } else {
      await this.prismaService.mutedChat.create({
        data: {
          userId,
          chatId
        }
      })
    }
  }

  /**
   * Отключение заглушения чата
   */
  async unMute(chatId: string, userId: string): Promise<void> {
    await this.prismaService.mutedChat.delete({
      where: {
        userId_chatId: {
          userId,
          chatId
        }
      }
    })
  }

  /**
   * Закрепление чата
   */
  async pin(
    chatId: string,
    pin: boolean = true,
    userId: string
  ): Promise<void> {
    if (pin) {
      await this.prismaService.pinnedChat.upsert({
        where: {
          userId_chatId: {
            userId,
            chatId
          }
        },
        update: {},
        create: {
          userId,
          chatId
        }
      })
    } else {
      await this.prismaService.pinnedChat.delete({
        where: {
          userId_chatId: {
            userId,
            chatId
          }
        }
      })
    }
  }

  /**
   * Создание пригласительной ссылки
   */
  async createInviteLink(
    chatId: string,
    userId: string,
    expiresAt?: Date
  ): Promise<{ link: string; expiresAt: Date }> {
    await this.checkAdminPermission(chatId, userId)

    const chat = await this.prismaService.chat.findUnique({
      where: { id: chatId }
    })

    if (!chat) {
      throw new NotFoundException('Чат не найден')
    }

    const link = this.generateInviteLink()

    const expirationDate = expiresAt || new Date(Date.now() + ms('2d'))

    await this.prismaService.chat.update({
      where: { id: chatId },
      data: {
        inviteLink: link
      }
    })

    return {
      link: `${process.env.CLIENT_URL}/join/${link}`,
      expiresAt: expirationDate
    }
  }

  /**
   * Присоединение по пригласительной ссылке
   */
  async joinByInviteLink(
    inviteLink: string,
    userId: string
  ): Promise<ChatResponseDto> {
    const chat = await this.prismaService.chat.findUnique({
      where: { inviteLink }
    })

    if (!chat) {
      throw new NotFoundException('Пригласительная ссылка недействительна')
    }

    if (chat.isPrivate) {
      throw new ForbiddenException(
        'Это приватный чат, присоединение по ссылке запрещено'
      )
    }

    const existingMember = await this.prismaService.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId: chat.id,
          userId
        }
      }
    })

    if (existingMember) {
      throw new ConflictException('Вы уже являетесь участником этого чата')
    }

    await this.prismaService.chatMember.create({
      data: {
        chatId: chat.id,
        userId,
        role: EnumMemberRole.MEMBER,
        joinedAt: new Date()
      }
    })

    await this.prismaService.message.create({
      data: {
        chatId: chat.id,
        senderId: userId,
        isSystem: true,
        content: `Присоединился(ась) к чату`
      }
    })

    const updatedChat = await this.findOne(chat.id, userId)

    // Эмитим событие о новом участнике
    this.eventEmitter.emit('chat.participant.joined', {
      chatId: chat.id,
      userId,
      chat: updatedChat
    })

    return updatedChat
  }

  /**
   * Проверка, является ли пользователь участником чата
   */
  async isChatMember(chatId: string, userId: string): Promise<boolean> {
    const member = await this.prismaService.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId
        }
      }
    })
    return !!member
  }

  /**
   * Получение количества непрочитанных сообщений для чата
   */
  async getUnreadCount(chatId: string, userId: string): Promise<number> {
    const member = await this.prismaService.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId
        }
      },
      select: { lastReadAt: true }
    })

    if (!member) return 0

    return this.prismaService.message.count({
      where: {
        chatId,
        createdAt: { gt: member.lastReadAt || new Date(0) },
        senderId: { not: userId },
        deletedAt: null
      }
    })
  }

  /**
   * Получение количества непрочитанных для всех чатов
   */
  async getUnreadCounts(userId: string): Promise<Record<string, number>> {
    const members = await this.prismaService.chatMember.findMany({
      where: { userId },
      select: {
        chatId: true,
        lastReadAt: true
      }
    })

    const counts: Record<string, number> = {}

    for (const member of members) {
      const count = await this.prismaService.message.count({
        where: {
          chatId: member.chatId,
          createdAt: { gt: member.lastReadAt || new Date(0) },
          senderId: { not: userId },
          deletedAt: null
        }
      })
      counts[member.chatId] = count
    }

    return counts
  }

  /**
   * Обновление времени последнего прочтения
   */
  async updateLastReadAt(chatId: string, userId: string): Promise<void> {
    await this.prismaService.chatMember.update({
      where: {
        chatId_userId: {
          chatId,
          userId
        }
      },
      data: { lastReadAt: new Date() }
    })
  }

  //#region private methods

  private async connectPinnedMessageToChat(chat) {
    const pinnedMessage = await this.prismaService.message.findUnique({
      where: {
        id: chat.pinnedMessageId,
        chatId: chat.id
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        }
      }
    })

    const newChat = { ...chat, pinnedMessage }

    return newChat
  }

  private async connectLastMessageToChat(chat) {
    const lastMessage = await this.prismaService.message.findUnique({
      where: {
        id: chat.lastMessageId,
        chatId: chat.id
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        }
      }
    })

    const newChat = { ...chat, lastMessage }

    return newChat
  }

  /**
   * Проверка прав администратора
   */
  private async checkAdminPermission(
    chatId: string,
    userId: string
  ): Promise<void> {
    const member = await this.prismaService.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId
        }
      },
      include: {
        chat: {
          include: {
            admins: {
              where: { userId }
            }
          }
        }
      }
    })

    if (!member) {
      throw new ForbiddenException('Вы не являетесь участником чата')
    }

    if (
      member.role === EnumMemberRole.OWNER ||
      member.role === EnumMemberRole.ADMIN
    ) {
      return
    }

    throw new ForbiddenException('У вас нет прав на это действие')
  }

  /**
   * Проверка роли владельца
   */
  private async checkOwnerRole(chatId: string, userId: string): Promise<void> {
    const member = await this.prismaService.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId
        }
      }
    })

    if (!member || member.role !== EnumMemberRole.OWNER) {
      throw new ForbiddenException(
        'Только владелец чата может выполнить это действие'
      )
    }
  }

  /**
   * Поиск существующего DIRECT чата
   */
  private async findDirectChat(
    userId1: string,
    userId2: string
  ): Promise<ChatResponseDto | null> {
    const mainChat = await this.prismaService.chat.findFirst({
      where: {
        type: EnumChatType.DIRECT,
        members: {
          every: {
            userId: { in: [userId1, userId2] }
          }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                avatar: true,
                status: true,
                lastSeen: true
              }
            }
          }
        }
      }
    })

    if (!mainChat) return null

    let newChat = mainChat

    if (mainChat.lastMessageId)
      newChat = await this.connectLastMessageToChat(mainChat)
    if (mainChat.pinnedMessageId)
      newChat = await this.connectPinnedMessageToChat(mainChat)

    return this.mapToResponseDto(newChat)
  }

  /**
   * Генерация пригласительной ссылки
   */
  private generateInviteLink(): string {
    return uuidv4().replace(/-/g, '')
  }

  /**
   * Маппинг в Response DTO
   */
  private mapToResponseDto(
    chat: any,
    unreadCount: number = 0
  ): ChatResponseDto {
    const isArchived = chat.archivedBy?.length > 0
    const isMuted = chat.mutedBy?.length > 0
    const isPinned = chat.pinnedChats?.length > 0

    const participants = chat.members?.map(member => ({
      id: member.user.id,
      username: member.user.username,
      firstName: member.user.firstName,
      lastName: member.user.lastName,
      avatar: member.user.avatar,
      role: member.role,
      status: member.user.status,
      lastSeen: member.user.lastSeen,
      joinedAt: member.joinedAt,
      lastReadAt: member.lastReadAt
    }))

    return plainToInstance(
      ChatResponseDto,
      {
        ...chat,
        participants,
        unreadCount,
        isArchived,
        isMuted,
        isPinned,
        participantCount: chat._count?.members || participants?.length || 0
      },
      {
        excludeExtraneousValues: true
      }
    )
  }
}
