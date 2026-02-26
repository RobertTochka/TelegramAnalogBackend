import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface
} from 'class-validator'

import { ChangePasswordDto } from '../dto'

@ValidatorConstraint({ name: 'IsNewPasswordMatchingOld', async: false })
export class IsNewPasswordMatchingOld implements ValidatorConstraintInterface {
  public validate(password: string, args: ValidationArguments): boolean {
    const obj = args.object as ChangePasswordDto
    if (!obj.oldPassword) return true
    return obj.oldPassword !== password
  }

  public defaultMessage(validationArguments?: ValidationArguments): string {
    return 'Новый пароль не должен совпадать со старым.'
  }
}
