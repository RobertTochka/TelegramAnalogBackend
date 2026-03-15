import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient, RedisClientType } from 'redis'

export const REDIS_CLIENT = 'REDIS_CLIENT'
export const REDIS_SUBSCRIBER = 'REDIS_SUBSCRIBER'

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: async (config: ConfigService) => {
        const url = config.get<string>('REDIS_URI')
        const client: RedisClientType = createClient({ url })
        client.on('error', err => console.error('Redis client error', err))
        await client.connect()
        return client
      },
      inject: [ConfigService]
    },
    {
      provide: REDIS_SUBSCRIBER,
      useFactory: async (config: ConfigService) => {
        const url = config.get<string>('REDIS_URI')
        const sub: RedisClientType = createClient({ url })
        sub.on('error', err => console.error('Redis subscriber error', err))
        await sub.connect()
        return sub
      },
      inject: [ConfigService]
    }
  ],
  exports: [REDIS_CLIENT, REDIS_SUBSCRIBER]
})
export class RedisModule {}
