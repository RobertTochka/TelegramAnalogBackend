import { EnumUserVisibility } from '@prisma/__generated__/enums'
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength
} from 'class-validator'

export class UpdateUserDto {
  @IsEmail({}, { message: 'Некорректный email' })
  @IsOptional()
  email?: string

  @IsString()
  @MaxLength(20, { message: 'Имя должно содержать максимум 20 символов' })
  @IsOptional()
  firstName?: string

  @IsString()
  @MaxLength(20, { message: 'Фамилия должна содержать максимум 20 символов' })
  @IsOptional()
  lastName?: string

  @IsUrl({}, { message: 'Некорректный URL аватара' })
  @IsOptional()
  avatar?: string

  @IsPhoneNumber(null, { message: 'Некорректный номер телефона' })
  @IsOptional()
  phone?: string

  @IsString()
  @MinLength(3, {
    message: 'Имя пользователя должно содержать минимум 3 символа'
  })
  @MaxLength(10, {
    message: 'Имя пользователя должно содержать максимум 10 символов'
  })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message:
      'Имя пользователя может содержать только латинские буквы, цифры и нижнее подчеркивание'
  })
  @IsOptional()
  username?: string

  @IsString()
  @MaxLength(20, {
    message: 'Имя пользователя должно содержать максимум 20 символов'
  })
  @IsOptional()
  description?: string

  @IsEnum(EnumUserVisibility)
  @IsOptional()
  visibility?: EnumUserVisibility
}
