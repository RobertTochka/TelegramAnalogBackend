import { Inject, Injectable, Logger } from '@nestjs/common'
import { EnumUserStatus } from '@prisma/__generated__/enums'
import { RedisClientType } from 'redis'

import { PrismaService } from '@/prisma.service'
import { REDIS_CLIENT } from '@/redis/RedisModule'

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name)
  private readonly offlineDelayMs = 5000
  private readonly offlineTimers = new Map<string, NodeJS.Timeout>()

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: RedisClientType,
    private readonly prisma: PrismaService
  ) {}

  private socketsKey(userId: string) {
    return `user:${userId}:sockets`
  }

  async addSocket(userId: string, socketId: string) {
    const key = this.socketsKey(userId)

    let count = await this.redis.sCard(key)

    if (count === 0) {
      await this.redis.sAdd(key, socketId)
      await this.redis.expire(key, 60 * 60 * 24)
      count = await this.redis.sCard(key)
    }
    this.logger.log(`addSocket ${userId} -> sockets=${count}`)

    // отменяем отложенное offline
    const timerKey = `${userId}:offline`
    if (this.offlineTimers.has(timerKey)) {
      clearTimeout(this.offlineTimers.get(timerKey))
      this.offlineTimers.delete(timerKey)
    }

    if (count === 1) {
      // первое подключение -> online
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          status: EnumUserStatus.ONLINE
        }
      })

      await this.redis.publish(
        'presence:events',
        JSON.stringify({ type: 'online', userId, at: new Date().toISOString() })
      )
    }
  }

  async removeSocket(userId: string, socketId: string) {
    const key = this.socketsKey(userId)
    await this.redis.sRem(key, socketId)
    const count = await this.redis.sCard(key)
    this.logger.log(`removeSocket ${userId} -> sockets=${count}`)

    if (count === 0) {
      const timerKey = `${userId}:offline`

      const t = setTimeout(async () => {
        // re-check
        const c = await this.redis.sCard(key)
        if (c === 0) {
          const lastSeen = new Date()
          // update DB
          try {
            await this.prisma.user.update({
              where: { id: userId },
              data: { lastSeen }
            })
          } catch (e) {
            this.logger.warn(`Failed to update lastSeen for ${userId}: ${e}`)
          }

          await this.prisma.user.update({
            where: { id: userId },
            data: {
              status: EnumUserStatus.OFFLINE,
              lastSeen
            }
          })

          await this.redis.publish(
            'presence:events',
            JSON.stringify({
              type: 'offline',
              userId,
              lastSeen: lastSeen.toISOString()
            })
          )
        }
        this.offlineTimers.delete(timerKey)
      }, this.offlineDelayMs)

      this.offlineTimers.set(timerKey, t)
    }
  }

  async isOnline(userId: string) {
    const c = await this.redis.sCard(this.socketsKey(userId))
    return c > 0
  }

  async getStatuses(userIds: string[]) {
    // простой pipeline
    const pipeline = this.redis.multi()
    for (const id of userIds) pipeline.sCard(this.socketsKey(id))
    const results = await pipeline.exec()
    return userIds.map((id, i) => {
      const r = results?.[i]
      const count = Array.isArray(r)
        ? (r[1] as number)
        : (r as unknown as number)
      return { userId: id, online: !!count }
    })
  }
}
