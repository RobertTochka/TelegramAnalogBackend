import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import { EnumTokenType } from '@prisma/__generated__/enums'
import { Request } from 'express'

import { MailService } from '@/libs/mail/mail.service'
import { PrismaService } from '@/prisma.service'
import { UserService } from '@/user/user.service'

import { AuthService } from '../auth.service'

@Injectable()
export class EmailConfirmationService {
  public constructor(
    private readonly prismaService: PrismaService,
    private readonly mailService: MailService,
    private readonly userService: UserService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService
  ) {}

  private async generateVerificationToken(email: string) {
    const token = Math.floor(
      Math.random() * (1000000 - 100000) + 100000
    ).toString()
    const expiresIn = new Date(new Date().getTime() + 300000)

    const existingToken = await this.prismaService.token.findFirst({
      where: {
        email,
        type: EnumTokenType.VERIFICATION
      }
    })

    if (existingToken) {
      await this.prismaService.token.delete({
        where: {
          id: existingToken.id,
          type: EnumTokenType.VERIFICATION
        }
      })
    }

    const verificationToken = await this.prismaService.token.create({
      data: {
        email,
        token,
        expiresIn,
        type: EnumTokenType.VERIFICATION
      }
    })

    return verificationToken
  }

  public async newVerification(email: string, code: string, req: Request) {
    const existingToken = await this.prismaService.token.findUnique({
      where: {
        token: code,
        type: EnumTokenType.VERIFICATION
      }
    })

    if (!existingToken)
      throw new NotFoundException(
        'Код подтверждения не найден. Пожалуйста, убедитесь, что у вас правильный код.'
      )

    if (existingToken.token !== code)
      throw new BadRequestException(
        'Неверный код подтверждения. Пожалуйста, проверьте введенный код и попробуйте снова.'
      )

    const hasExpired = new Date(existingToken.expiresIn) < new Date()

    if (hasExpired)
      throw new BadRequestException(
        'Код подтверждения истек. Пожалуйста, запросите новый код для подтверждения.'
      )

    if (existingToken.email !== email)
      throw new BadRequestException(
        'Код подтверждения неверный. Пожалуйста, запросите новый код для подтверждения.'
      )

    const existingUser = await this.userService.findByEmail(existingToken.email)

    if (!existingUser)
      throw new NotFoundException(
        'Пользователь не найден. Пожалуйста, Проверьте адрес электронной почты и попробуйте снова.'
      )

    await this.prismaService.token.delete({
      where: {
        id: existingToken.id,
        type: EnumTokenType.VERIFICATION
      }
    })

    return this.authService.saveSession(req, existingUser)
  }

  public async sendVerificationToken(email: string) {
    const verificationToken = await this.generateVerificationToken(email)

    // await this.mailService.sendConfirmationEmail(
    //   verificationToken.email,
    //   verificationToken.token
    // )

    // return true

    return await this.mailService.sendConfirmationEmail(
      verificationToken.email,
      verificationToken.token
    )
  }
}
