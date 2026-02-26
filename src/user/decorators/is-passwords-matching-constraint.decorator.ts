import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface
} from 'class-validator'

import { ChangePasswordDto } from '../dto'

@ValidatorConstraint({ name: 'IsPasswordsMatching', async: false })
export class IsPasswordsMatchingConstraint implements ValidatorConstraintInterface {
  public validate(passwordRepeat: string, args: ValidationArguments): boolean {
    const obj = args.object as ChangePasswordDto
    return obj.password === passwordRepeat
  }

  public defaultMessage(validationArguments?: ValidationArguments): string {
    return 'Пароли не совпадают.'
  }
}
