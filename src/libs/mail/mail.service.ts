import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { render } from '@react-email/components'
import { Resend } from 'resend'

import { ConfirmationTemplate } from './templates/confirmation.template'
import { ResetPasswordTemplate } from './templates/reset-password.template'

@Injectable()
export class MailService {
  public constructor(private readonly configService: ConfigService) {}

  public async sendConfirmationEmail(email: string, token: string) {
    return ConfirmationTemplate(token)
    // const html = await render(ConfirmationTemplate({ domain, token }))

    // return this.sendMail(email, 'Подтверждение почты', html)
  }

  public async sendPasswordResetEmail(email: string, token: string) {
    const domain = this.configService.getOrThrow<string>('ALLOWED_ORIGIN')

    return ResetPasswordTemplate({ domain, token })
    // const html = await render(ResetPasswordTemplate({ domain, token }))

    // return this.sendMail(email, 'Сброс пароля', html)
  }

  private async sendMail(email: string, subject: string, html: string) {
    const resend = new Resend(
      this.configService.getOrThrow<string>('MAIL_SECRET')
    )

    const { data, error } = await resend.emails.send({
      from: this.configService.getOrThrow<string>('MAIL_FROM'),
      to: [email],
      subject,
      html
    })

    if (error) {
      return console.error({ error })
    }

    console.log({ data })
  }
}
