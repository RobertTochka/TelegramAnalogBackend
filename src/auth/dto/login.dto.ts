import { IsEmail, IsOptional, IsString } from 'class-validator'

export class LoginDto {
  @IsEmail({}, { message: 'Некорректный email' })
  email: string

  @IsString()
  @IsOptional()
  password?: string
}
