import { INestApplicationContext } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { IoAdapter } from '@nestjs/platform-socket.io'
import { parse } from 'cookie'
import { ServerOptions } from 'socket.io'

export class SessionIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private configService: ConfigService,
    private redis: any
  ) {
    super(app)
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: this.configService.get('ALLOWED_ORIGIN'),
        credentials: true
      },
      cookie: true
    })

    server.of(/.*/).use(async (socket, next) => {
      try {
        const cookies = socket.handshake.headers.cookie

        if (!cookies) {
          return next(new Error('No cookies provided'))
        }

        const parsedCookies = parse(cookies)
        const sessionName = this.configService.get('SESSION_NAME')
        let sessionId = parsedCookies[sessionName]

        if (!sessionId) {
          return next(new Error('No session cookie'))
        }

        if (sessionId.startsWith('s:')) {
          sessionId = sessionId.substring(2)
        }
        const dotIndex = sessionId.indexOf('.')
        if (dotIndex !== -1) {
          sessionId = sessionId.substring(0, dotIndex)
        }

        const sessionFolder = this.configService.get('SESSION_FOLDER')
        const sessionKey = `${sessionFolder}${sessionId}`
        const sessionData = (await this.redis.get(sessionKey)) as string

        if (!sessionData) {
          return next(new Error('Session not found'))
        }

        const session = JSON.parse(sessionData)

        if (!session.userId) {
          return next(new Error('User not authenticated'))
        }

        socket.data.userId = session.userId

        next()
      } catch (error) {
        console.error('Auth error:', error)
        next(new Error('Authentication failed'))
      }
    })
    return server
  }
}
