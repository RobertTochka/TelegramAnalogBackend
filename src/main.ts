import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { IoAdapter } from '@nestjs/platform-socket.io'
import { RedisStore } from 'connect-redis'
import { parse } from 'cookie'
import * as cookieParser from 'cookie-parser'
import * as session from 'express-session'
import { createClient } from 'redis'
import { ServerOptions } from 'socket.io'

import { AppModule } from './app.module'
import { SessionIoAdapter } from './libs/common/adapters'
import { ms, parseBoolean, StringValue } from './libs/common/utils'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const config = app.get(ConfigService)
  const redis = createClient({ url: config.getOrThrow<string>('REDIS_URI') })

  redis.on('error', err => console.error('Redis Client Error ', err))
  await redis.connect()

  app.useWebSocketAdapter(new SessionIoAdapter(app, config, redis))

  app.use(cookieParser(config.getOrThrow<string>('COOKIES_SECRET')))

  app.use(
    session({
      secret: config.getOrThrow<string>('SESSION_SECRET'),
      name: config.getOrThrow<string>('SESSION_NAME'),
      resave: true,
      saveUninitialized: false,
      cookie: {
        domain: config.getOrThrow<string>('SESSION_DOMAIN'),
        maxAge: ms(config.getOrThrow<StringValue>('SESSION_MAX_AGE')),
        httpOnly: parseBoolean(config.getOrThrow<string>('SESSION_HTTP_ONLY')),
        secure: parseBoolean(config.getOrThrow<string>('SESSION_SECURE')),
        sameSite: 'none'
      },
      store: new RedisStore({
        client: redis,
        prefix: config.getOrThrow<string>('SESSION_FOLDER')
      })
    })
  )

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true
    })
  )

  app.enableCors({
    origin: config.getOrThrow<string>('ALLOWED_ORIGIN'),
    credentials: true,
    exposedHeaders: ['set-cookie']
  })

  await app.listen(config.getOrThrow<number>('APPLICATION_PORT'))
}
bootstrap()
