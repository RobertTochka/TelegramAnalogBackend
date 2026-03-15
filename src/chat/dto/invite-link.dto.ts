import { IsDate, IsString } from 'class-validator'

export class InviteLinkDto {
  @IsString()
  link: string

  @IsDate()
  expiresAt: Date
}
