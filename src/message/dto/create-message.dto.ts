import { EnumMediaType } from '@prisma/__generated__/enums'
import { IsBoolean, IsOptional, IsString } from 'class-validator'

export class CreateMessageDto {
  @IsString()
  chatId: string

  @IsString()
  @IsOptional()
  content: string

  @IsString()
  @IsOptional()
  replyToId?: string

  @IsString()
  @IsOptional()
  forwardedFromId?: string

  @IsBoolean()
  @IsOptional()
  isSystem?: boolean

  @IsOptional()
  media?: {
    url: string
    type: EnumMediaType
    fileName: string
    fileSize: number
    safeName: string
  }[]
}
