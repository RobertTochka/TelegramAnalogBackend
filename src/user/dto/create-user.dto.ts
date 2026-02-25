import { IsEmail, IsString, MaxLength } from 'class-validator'

export class CreateUserDto {
  @IsEmail({}, { message: 'Некорректный email' })
  email: string

  @IsString()
  @MaxLength(20, { message: 'Имя должно содержать максимум 20 символов' })
  firstName: string

  @IsString()
  @MaxLength(20, { message: 'Фамилия должна содержать максимум 20 символов' })
  lastName: string
}
