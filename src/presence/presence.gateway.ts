import { Inject, Logger, OnModuleInit, UseGuards } from '@nestjs/common'
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets'
import { RedisClientType } from 'redis'
import { Server, Socket } from 'socket.io'

import { REDIS_SUBSCRIBER } from '@/redis/RedisModule'

import { PresenceService } from './presence.service'

@WebSocketGateway({
  namespace: '/user',
  cors: {
    origin: process.env.ALLOWED_ORIGIN,
    credentials: true
  },
  transports: ['websocket', 'polling'],
  cookie: true
})
export class PresenceGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer() server: Server
  private readonly logger = new Logger(PresenceGateway.name)

  constructor(
    private readonly presence: PresenceService,
    @Inject(REDIS_SUBSCRIBER) private readonly subscriber: RedisClientType
  ) {}

  async onModuleInit() {
    // Подписываемся на канал presence:events и ретранслируем в socket.io
    try {
      await this.subscriber.subscribe('presence:events', (msg: string) => {
        try {
          const payload = JSON.parse(msg)
          // Простая ретрансляция всем подключённым клиентам
          // Клиент сам будет фильтровать по интересующим userId (или можно улучшить)
          this.server.emit('user:presence', payload)
          this.logger.log(`presence event relayed: ${JSON.stringify(payload)}`)
        } catch (e) {
          this.logger.error('Failed to parse presence event', e)
        }
      })
      this.logger.log('Subscribed to presence:events')
    } catch (e) {
      this.logger.error('Failed to subscribe to presence:events', e)
    }
  }

  async handleConnection(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId as string
    this.logger.log(`presence connection: ${client.id} user=${userId}`)

    if (!userId) {
      client.disconnect()
      return
    }

    // join personal room to allow targeted emits later if нужно
    client.join(`user:${userId}`)

    await this.presence.addSocket(userId, client.id)
  }

  async handleDisconnect(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId as string
    this.logger.log(`presence disconnect: ${client.id} user=${userId}`)
    if (!userId) return

    await this.presence.removeSocket(userId, client.id)
  }
}
