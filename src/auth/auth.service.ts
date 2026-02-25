import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { User } from '@prisma/__generated__/client'
import { verify } from 'argon2'
import { Request, Response } from 'express'

import { UserService } from '@/user/user.service'

import { LoginDto, RegisterDto } from './dto'
import { EmailConfirmationService } from './email-confirmation/email-confirmation.service'

@Injectable()
export class AuthService {
  public constructor(
    private readonly userService: UserService,
    private readonly configService: ConfigService,
    private readonly emailConfirmationService: EmailConfirmationService
  ) {}

  public async register(dto: RegisterDto) {
    const isExists = await this.userService.findByEmail(dto.email)

    if (isExists) {
      throw new ConflictException(
        'Регистрация не удалась. Пользователь с таким email уже существует. Пожалуйста, используйте другой email или  войдите в систему.'
      )
    }

    const newUser = await this.userService.create({
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName
    })

    const code = await this.emailConfirmationService.sendVerificationToken(
      newUser.email
    )

    return {
      message: `Пожалуйста, введите код из вашего email. Сообщение было отправлено на ваш почтовый адрес. ${code}`
    }

    // await this.emailConfirmationService.sendVerificationToken(newUser)

    // return {
    //   message:
    //     'Вы успешно зарегестрировались. Пожалуйста, подтвердите ваш email. Сообщение было отправлено на ваш почтовый адрес.'
    // }
  }

  public async login(req: Request, dto: LoginDto) {
    const user = await this.userService.findByEmail(dto.email)

    if (!user)
      throw new NotFoundException(
        'Пользователь не найден. Пожалуйста, проверьте введенные данные.'
      )

    if (user.isPasswordEnabled) {
      const isValidPassword = await verify(user.password, dto.password)

      if (!isValidPassword)
        throw new UnauthorizedException(
          'Неверный пароль. Пожалуйста, проверьте еще раз или восстановите пароль, если забыли его.'
        )
    }

    const code = await this.emailConfirmationService.sendVerificationToken(
      user.email
    )

    return {
      message: `Пожалуйста, введите код из вашего email. Сообщение было отправлено на ваш почтовый адрес. ${code}`
    }

    // if (!dto.code) {
    //   await this.twoFactorAuthService.sendTwoFactorToken(user.email)

    //   return {
    //     message:
    //       'Проверьте вашу почту. Требуется код двухфакторной аутентификации.'
    //   }
    // }
  }

  public async logout(req: Request, res: Response): Promise<void> {
    return new Promise((resolve, reject) => {
      req.session.destroy(err => {
        if (err)
          return reject(
            new InternalServerErrorException(
              'Не удалось завершить сессию. Возможно, возникла проблема с сервером или сессия уже была завершена'
            )
          )

        res.clearCookie(this.configService.getOrThrow<string>('SESSION_NAME'))
        resolve()
      })
    })
  }

  public async saveSession(req: Request, user: User) {
    return new Promise((resolve, reject) => {
      req.session.userId = user.id

      req.session.save(err => {
        if (err) {
          return reject(
            new InternalServerErrorException(
              'Не удалось сохранить сессию. Проверьте, правильно ли настроены параметры сессии.'
            )
          )
        }

        resolve({ user })
      })
    })
  }
}
