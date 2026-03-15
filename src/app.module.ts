import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { AuthModule } from './auth/auth.module'
import { EmailConfirmationModule } from './auth/email-confirmation/email-confirmation.module'
import { ChatModule } from './chat/chat.module'
import { IS_DEV_ENV } from './libs/common/utils'
import { MailModule } from './libs/mail/mail.module'
import { MessageModule } from './message/message.module'
import { PresenceModule } from './presence/presence.module'
import { PrismaService } from './prisma.service'
import { RedisModule } from './redis/RedisModule'
import { UserModule } from './user/user.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      ignoreEnvFile: !IS_DEV_ENV,
      isGlobal: true
    }),
    RedisModule,
    MailModule,
    UserModule,
    AuthModule,
    EmailConfirmationModule,
    MessageModule,
    ChatModule,
    PresenceModule
  ],
  providers: [PrismaService]
})
export class AppModule {}
