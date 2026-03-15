import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { RedisStore } from 'connect-redis'
import * as cookieParser from 'cookie-parser'
import * as session from 'express-session'
import { createClient } from 'redis'

import { AppModule } from './app.module'
import { SessionIoAdapter } from './libs/common/adapters'
import { isDev, ms, parseBoolean, StringValue } from './libs/common/utils'
import { REDIS_CLIENT } from './redis/RedisModule'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const config = app.get(ConfigService)
  const redis = app.get(REDIS_CLIENT)

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
        secure: !isDev(config),
        sameSite: isDev(config) ? 'lax' : 'none'
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

  await app.listen(parseInt(config.getOrThrow('APPLICATION_PORT')) || 5000)
}
bootstrap()
