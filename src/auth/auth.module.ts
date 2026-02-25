import { forwardRef, Module } from '@nestjs/common'

import { MailService } from '@/libs/mail/mail.service'
import { PrismaService } from '@/prisma.service'
import { UserService } from '@/user/user.service'

import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { EmailConfirmationModule } from './email-confirmation/email-confirmation.module'
import { EmailConfirmationService } from './email-confirmation/email-confirmation.service'

@Module({
  imports: [forwardRef(() => EmailConfirmationModule)],
  controllers: [AuthController],
  providers: [AuthService, UserService, MailService, PrismaService],
  exports: [AuthService]
})
export class AuthModule {}
