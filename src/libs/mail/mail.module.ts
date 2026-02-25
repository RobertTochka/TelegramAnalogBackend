import { MailerModule } from '@nestjs-modules/mailer'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'

import { getMailerConfig } from '@/config'

import { MailService } from './mail.service'

@Module({
  imports: [
    MailerModule.forRootAsync({
      useFactory: getMailerConfig,
      inject: [ConfigService]
    }),
    ConfigModule
  ],
  providers: [MailService]
})
export class MailModule {}
