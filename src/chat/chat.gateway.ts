import { Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'

import { PrismaService } from '@/prisma.service'

import { ChatService } from './chat.service'

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string
  }
}

@WebSocketGateway({
  cors: {
    origin: process.env.ALLOWED_ORIGIN,
    credentials: true
  },
  namespace: '/chats',
  transports: ['websocket', 'polling'],
  cookie: true
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  private logger = new Logger(ChatGateway.name)

  private userSockets: Map<string, Set<string>> = new Map() // userId -> Set socketId

  constructor(
    private prismaService: PrismaService,
    private chatService: ChatService
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      this.logger.log(`Connection attempt from ${client.id}`)

      const userId = client.data.userId

      this.logger.log(`User ID from socket data: ${userId}`)

      if (!userId) {
        client.disconnect()
        return
      }

      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set())
      }
      this.userSockets.get(userId).add(client.id)

      console.log(`Client connected: ${client.id} (user: ${userId})`)
    } catch (error) {
      console.error('Connection error:', error)
      client.disconnect()
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.data.userId

    if (userId) {
      const userSockets = this.userSockets.get(userId)
      if (userSockets) {
        userSockets.delete(client.id)
        if (userSockets.size === 0) {
          this.userSockets.delete(userId)
        }
      }
    }
  }

  /**
   * Отправка уведомления конкретному пользователю
   */
  private notifyUser(userId: string, event: string, data: any) {
    const sockets = this.userSockets.get(userId)
    if (sockets) {
      sockets.forEach(socketId => {
        this.server.to(socketId).emit(event, data)
      })
    }
  }

  /**
   * Отправка уведомления нескольким пользователям
   */
  private notifyUsers(userIds: string[], event: string, data: any) {
    userIds.forEach(userId => {
      this.notifyUser(userId, event, data)
    })
  }

  /**
   * Событие: создан новый чат
   */
  @OnEvent('chat.created')
  handleChatCreated(payload: {
    chatId: string
    chat: any
    participantIds: string[]
    createdBy: string
  }) {
    const { chatId, chat, participantIds, createdBy } = payload

    const notifyUserIds = participantIds.filter(id => id !== createdBy)

    this.notifyUsers(notifyUserIds, 'chat:new', {
      chatId,
      chat,
      message: 'Вас добавили в новый чат'
    })
  }

  /**
   * Событие: удален чат
   */
  @OnEvent('chat.deleted')
  handleChatDeleted(payload: {
    chatId: string
    participantIds: string[]
    deletedBy: string
  }) {
    const { chatId, participantIds, deletedBy } = payload

    const notifyUserIds = participantIds.filter(id => id !== deletedBy)

    this.notifyUsers(notifyUserIds, 'chat:deleted', {
      chatId,
      deletedBy,
      message: 'Чат был удален'
    })
  }

  /**
   * Событие: добавлены новые участники
   */
  @OnEvent('chat.participants.added')
  handleParticipantsAdded(payload: {
    chatId: string
    newParticipantIds: string[]
    chat: any
  }) {
    const { chatId, newParticipantIds, chat } = payload

    this.notifyUsers(newParticipantIds, 'chat:added', {
      chatId,
      chat,
      message: 'Вас добавили в чат'
    })
  }

  @OnEvent('chat.participants.removed')
  handleParticipantsRemoved(payload: {
    chatId: string
    removedParticipantIds: string[]
  }) {
    const { chatId, removedParticipantIds } = payload

    this.notifyUsers(removedParticipantIds, 'chat:removed', {
      chatId,
      message: 'Вас удалили из чата'
    })
  }

  /**
   * Событие: участник присоединился по ссылке
   */
  @OnEvent('chat.participant.joined')
  handleParticipantJoined(payload: {
    chatId: string
    userId: string
    chat: any
  }) {
    const { chatId, userId, chat } = payload

    this.prismaService.chatMember
      .findMany({
        where: { chatId },
        select: { userId: true }
      })
      .then(members => {
        const otherMembers = members
          .map(m => m.userId)
          .filter(id => id !== userId)

        this.notifyUsers(otherMembers, 'chat:participant:joined', {
          chatId,
          userId,
          message: 'Новый участник присоединился к чату'
        })
      })
  }

  /**
   * Событие: участник покинул чат
   */
  @OnEvent('chat.participant.left')
  handleParticipantLeft(payload: { chatId: string; userId: string }) {
    const { chatId, userId } = payload

    // Уведомляем остальных участников
    this.prismaService.chatMember
      .findMany({
        where: { chatId },
        select: { userId: true }
      })
      .then(members => {
        const otherMembers = members.map(m => m.userId)

        this.notifyUsers(otherMembers, 'chat:participant:left', {
          chatId,
          userId,
          message: 'Участник покинул чат'
        })
      })
  }
}
