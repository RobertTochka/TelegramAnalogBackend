import { EnumChatType } from '@prisma/__generated__/enums'
import { Transform, Type } from 'class-transformer'
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min
} from 'class-validator'

export class ChatFilterDto {
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isMy: boolean

  @IsEnum(EnumChatType)
  @IsOptional()
  type?: EnumChatType

  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean

  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  @IsOptional()
  isArchived?: boolean

  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  @IsOptional()
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
