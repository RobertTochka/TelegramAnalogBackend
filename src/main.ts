import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { RedisStore } from 'connect-redis'
import * as cookieParser from 'cookie-parser'
import * as session from 'express-session'
import * as fs from 'fs'
import * as path from 'path'

import { AppModule } from './app.module'
import { AVATARS_DIR, UPLOADS_DIR } from './constants/path.constants'
import { SessionIoAdapter } from './libs/common/adapters'
import { isDev, ms, parseBoolean, StringValue } from './libs/common/utils'
import { REDIS_CLIENT } from './redis/RedisModule'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  const config = app.get(ConfigService)
  const redis = app.get(REDIS_CLIENT)

  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true })
  }
  if (!fs.existsSync(AVATARS_DIR)) {
    fs.mkdirSync(AVATARS_DIR, { recursive: true })
  }

  app.useStaticAssets(UPLOADS_DIR, {
    prefix: '/uploads/'
  })

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
