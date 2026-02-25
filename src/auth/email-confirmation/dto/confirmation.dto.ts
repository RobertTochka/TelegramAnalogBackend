import { IsEmail, IsNotEmpty, IsString } from 'class-validator'

export class ConfirmationDto {
  @IsEmail({}, { message: 'Некорректный email' })
  email: string

  @IsString({ message: 'Код должен быть строкой.' })
  @IsNotEmpty({ message: 'Поле код не может быть пустым.' })
  code: string
}
