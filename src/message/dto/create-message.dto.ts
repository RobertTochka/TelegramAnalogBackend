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
}
