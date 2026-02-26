import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { AuthModule } from './auth/auth.module'
import { EmailConfirmationModule } from './auth/email-confirmation/email-confirmation.module'
import { IS_DEV_ENV } from './libs/common/utils'
import { MailModule } from './libs/mail/mail.module'
import { UserModule } from './user/user.module'
import { MessageModule } from './message/message.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      ignoreEnvFile: !IS_DEV_ENV,
      isGlobal: true
    }),
    MailModule,
    UserModule,
    AuthModule,
    EmailConfirmationModule,
    MessageModule,
    ChatModule
  ]
})
export class AppModule {}
