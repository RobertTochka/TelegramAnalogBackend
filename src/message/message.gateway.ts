import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException
} from '@nestjs/websockets'
import { EnumMessageStatus } from '@prisma/__generated__/enums'
import { Server, Socket } from 'socket.io'

import { PrismaService } from '@/prisma.service'

import { CreateMessageDto } from './dto'
import { MessageService } from './message.service'

interface MessageEventMap {
  'message:send': { dto: CreateMessageDto; tempId: string }
  'message:edit': { messageId: string; content: string }
  'message:delete': { messageId: string; forEveryone: boolean }
  'message:status': { messageId: string; status: EnumMessageStatus }
  typing: { chatId: string; isTyping: boolean }
}

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
  namespace: 'messages',
  transports: ['websocket', 'polling'],
  cookie: true
})
export class MessageGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server

  private readonly userSockets: Map<string, Set<string>> = new Map()
  private readonly typingTimeouts: Map<string, NodeJS.Timeout> = new Map()

  constructor(
    private readonly messageService: MessageService,
    private readonly prismaService: PrismaService
    // private readonly chatService: ChatService
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const userId = client.data.userId

      if (!userId) {
        client.disconnect()
        return
      }

      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set())
      }
      this.userSockets.get(userId).add(client.id)

      // Подключаем к комнатам чатов пользователя
      const userChats = await this.prismaService.chatMember.findMany({
        where: { userId },
        select: { chatId: true }
      })

      for (const { chatId } of userChats) {
        await client.join(`chat:${chatId}`)
      }

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
      }

      // Очищаем таймауты печатания
      for (const [key, timeout] of this.typingTimeouts.entries()) {
        if (key.startsWith(`${userId}:`)) {
          clearTimeout(timeout)
          this.typingTimeouts.delete(key)
        }
      }
    }

    console.log(`Client disconnected: ${client.id}`)
  }

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: CreateMessageDto & { tempId: string }
  ) {
    try {
      console.log('asdasd')
      const userId = client.data.userId

      const message = await this.messageService.create(userId, payload)

      this.server.to(`chat:${payload.chatId}`).emit('message:new', {
        ...message,
        tempId: payload.tempId // Для идентификации на клиенте
      })

      return { success: true, message, tempId: payload.tempId }
    } catch (error) {
      throw new WsException(error.message)
    }
  }

  @SubscribeMessage('message:edit')
  async handleEditMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { messageId: string; content: string }
  ) {
    try {
      const userId = client.data.userId

      const updatedMessage = await this.messageService.update(
        payload.messageId,
        userId,
        payload.content
      )

      this.server
        .to(`chat:${updatedMessage.chatId}`)
        .emit('message:updated', updatedMessage)

      return { success: true }
    } catch (error) {
      throw new WsException(error.message)
    }
  }

  @SubscribeMessage('message:delete')
  async handleDeleteMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { messageId: string; forEveryone: boolean }
  ) {
    try {
      const userId = client.data.userId

      const message = await this.messageService.findOne(
        payload.messageId,
        userId
      )

      await this.messageService.delete(
        payload.messageId,
        userId,
        payload.forEveryone
      )

      this.server.to(`chat:${message.chatId}`).emit('message:deleted', {
        messageId: payload.messageId,
        forEveryone: payload.forEveryone,
        deletedBy: userId
      })

      return { success: true }
    } catch (error) {
      throw new WsException(error.message)
    }
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { chatId: string; isTyping: boolean }
  ) {
    try {
      const userId = client.data.userId
      const { chatId, isTyping } = payload

      // const isMember = await this.chatService.isChatMember(chatId, user.id)
      // if (!isMember) {
      //   throw new WsException('Вы не являетесь участником этого чата')
      // }

      client.to(`chat:${chatId}`).emit('typing', {
        chatId,
        userId: userId,
        isTyping
      })

      // Управляем таймаутом для остановки печатания
      const timeoutKey = `${userId}:${chatId}`
      if (isTyping) {
        // Если уже есть таймаут, очищаем его
        if (this.typingTimeouts.has(timeoutKey)) {
          clearTimeout(this.typingTimeouts.get(timeoutKey))
        }

        const timeout = setTimeout(async () => {
          client.to(`chat:${chatId}`).emit('typing', {
            chatId,
            userId: userId,
            isTyping: false
          })
          this.typingTimeouts.delete(timeoutKey)
        }, 5000)

        this.typingTimeouts.set(timeoutKey, timeout)
      } else {
        if (this.typingTimeouts.has(timeoutKey)) {
          clearTimeout(this.typingTimeouts.get(timeoutKey))
          this.typingTimeouts.delete(timeoutKey)
        }
      }

      return { success: true }
    } catch (error) {
      throw new WsException(error.message)
    }
  }

  @SubscribeMessage('message:status')
  async handleMessageStatus(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { messageId: string; status: EnumMessageStatus }
  ) {
    try {
      const userId = client.data.userId

      await this.messageService.updateStatus(
        userId,
        payload.messageId,
        payload.status
      )

      // Уведомляем отправителя об изменении статуса
      const message = await this.messageService.findOne(
        payload.messageId,
        userId
      )
      this.server.to(`chat:${message.chatId}`).emit('message:status:updated', {
        messageId: payload.messageId,
        status: payload.status,
        userId
      })

      return { success: true }
    } catch (error) {
      throw new WsException(error.message)
    }
  }

  @SubscribeMessage('messages:read')
  async handleMarkAsRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { chatId: string; messageIds?: string[] }
  ) {
    try {
      const userId = client.data.userId

      await this.messageService.markAsRead(
        userId,
        payload.chatId,
        payload.messageIds
      )

      // Уведомляем участников чата о прочтении
      this.server.to(`chat:${payload.chatId}`).emit('messages:read', {
        chatId: payload.chatId,
        userId,
        messageIds: payload.messageIds,
        readAt: new Date()
      })

      return { success: true }
    } catch (error) {
      throw new WsException(error.message)
    }
  }
}
