import { EnumChatType } from '@prisma/__generated__/enums'
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf
} from 'class-validator'

export class CreateChatDto {
  @ValidateIf(o => o.type !== 'DIRECT')
  @IsString()
  @MinLength(3, { message: 'Название чата должно содержать минимум 3 символа' })
  @MaxLength(30, {
    message: 'Название чата должно содержать максимум 50 символов'
  })
  name?: string

  @IsString()
  @MaxLength(200, {
    message: 'Описание чата должно содержать максимум 200 символов'
  })
  @IsOptional()
  description?: string

  @IsEnum(EnumChatType, { message: 'Некорректный тип чата' })
  type: EnumChatType

  @IsArray()
  @IsString()
  @ArrayMinSize(1, { message: 'Чат должен содержать хотя бы одного участника' })
  participantIds: string[]

  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean

  @IsString()
  @IsOptional()
  avatar?: string
}
