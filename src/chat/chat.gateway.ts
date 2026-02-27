import { OnEvent } from '@nestjs/event-emitter'
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'

import { PrismaService } from '@/prisma.service'

interface AuthenticatedSocket extends Socket {
  user: {
    id: string
    username: string
  }
}

@WebSocketGateway({
  cors: {
    origin: process.env.ALLOWED_ORIGIN,
    credentials: true
  },
  namespace: 'chats',
  transports: ['websocket', 'polling'],
  cookie: true
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  private userSockets: Map<string, Set<string>> = new Map() // userId -> Set socketId

  constructor(private prismaService: PrismaService) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const user = client.user

      if (!user) {
        client.disconnect()
        return
      }

      if (!this.userSockets.has(user.id)) {
        this.userSockets.set(user.id, new Set())
      }
      this.userSockets.get(user.id).add(client.id)

      console.log(
        `Notifications client connected: ${client.id} (user: ${user.username})`
      )
    } catch (error) {
      console.error('Connection error:', error)
      client.disconnect()
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    const user = client.user

    if (user) {
      const userSockets = this.userSockets.get(user.id)
      if (userSockets) {
        userSockets.delete(client.id)
        if (userSockets.size === 0) {
          this.userSockets.delete(user.id)
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
    addedBy: string
    chat: any
  }) {
    const { chatId, newParticipantIds, addedBy, chat } = payload

    this.notifyUsers(newParticipantIds, 'chat:added', {
      chatId,
      chat,
      addedBy,
      message: 'Вас добавили в чат'
    })
  }

  @OnEvent('chat.participants.removed')
  handleParticipantsRemoved(payload: {
    chatId: string
    removedParticipantIds: string[]
    removedBy: string
  }) {
    const { chatId, removedParticipantIds, removedBy } = payload

    this.notifyUsers(removedParticipantIds, 'chat:removed', {
      chatId,
      removedBy,
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
