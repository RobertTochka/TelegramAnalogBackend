import { EnumChatType } from '@prisma/__generated__/enums'
import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min
} from 'class-validator'

export class ChatFilterDto {
  @IsEnum(EnumChatType)
  @IsOptional()
  type?: EnumChatType

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isPrivate?: boolean

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isArchived?: boolean

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isMuted?: boolean

  @IsString()
  @IsOptional()
  search?: string

  @IsString()
  @IsOptional()
  cursor?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20
}
