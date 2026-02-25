import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req
} from '@nestjs/common'
import { Request } from 'express'

import { ConfirmationDto } from './dto'
import { EmailConfirmationService } from './email-confirmation.service'

@Controller('auth/new-verification')
export class EmailConfirmationController {
  constructor(
    private readonly emailConfirmationService: EmailConfirmationService
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  public async newVerification(
    @Body() dto: ConfirmationDto,
    @Req() req: Request
  ) {
    return this.emailConfirmationService.newVerification(
      dto.email,
      dto.code,
      req
    )
  }
}
