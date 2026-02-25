import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { EnumUserRole } from '@prisma/__generated__/enums'

import { ROLES_KEY } from '../decorators'

@Injectable()
export class RolesGuard implements CanActivate {
  public constructor(private readonly reflector: Reflector) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<EnumUserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ])
    const request = context.switchToHttp().getRequest()

    if (!roles) return true

    if (!roles.includes(request.user.role))
      throw new ForbiddenException(
        'Недостаточно прав. У вас нет прав доступа к этому ресурсу.'
      )

    return true
  }
}
