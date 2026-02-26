import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  Validate
} from 'class-validator'

import {
  IsNewPasswordMatchingOld,
  IsPasswordsMatchingConstraint
} from '../decorators'

export class ChangePasswordDto {
  @IsString({ message: 'Пароль должен быть строкой.' })
  @IsNotEmpty({ message: 'Пароль обязателен для заполнения.' })
  @MinLength(6, { message: 'Пароль должен содержать минимум 6 символов.' })
  @IsOptional()
  oldPassword?: string

  @IsString({ message: 'Пароль должен быть строкой.' })
  @IsNotEmpty({ message: 'Пароль обязателен для заполнения.' })
  @MinLength(6, { message: 'Пароль должен содержать минимум 6 символов.' })
  @Validate(IsNewPasswordMatchingOld, {
    message: 'Новый пароль не должен совпадать со старым.'
  })
  password: string

  @IsString({ message: 'Пароль подтверждения должен быть строкой.' })
  @IsNotEmpty({ message: 'Пароль подтверждения обязателен для заполнения.' })
  @MinLength(6, {
    message: 'Пароль подтверждения должен содержать минимум 6 символов.'
  })
  @Validate(IsPasswordsMatchingConstraint, { message: 'Пароли не совпадают.' })
  passwordRepeat: string
}
