import { forwardRef, Module } from '@nestjs/common'

import { MailModule } from '@/libs/mail/mail.module'
import { MailService } from '@/libs/mail/mail.service'
import { PrismaService } from '@/prisma.service'
import { UserService } from '@/user/user.service'

import { AuthModule } from '../auth.module'

import { EmailConfirmationController } from './email-confirmation.controller'
import { EmailConfirmationService } from './email-confirmation.service'

@Module({
  imports: [MailModule, forwardRef(() => AuthModule)],
  providers: [
    EmailConfirmationService,
    UserService,
    MailService,
    PrismaService
  ],
  controllers: [EmailConfirmationController],
  exports: [EmailConfirmationService]
})
export class EmailConfirmationModule {}
