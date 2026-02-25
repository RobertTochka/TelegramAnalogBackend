import { applyDecorators, UseGuards } from '@nestjs/common'
import { EnumUserRole } from '@prisma/__generated__/enums'

import { AuthGuard, RolesGuard } from '../guards'

import { Roles } from './roles.decorator'

export function Authorization(...roles: EnumUserRole[]) {
  if (roles.length > 0)
    return applyDecorators(Roles(...roles), UseGuards(AuthGuard, RolesGuard))

  return applyDecorators(UseGuards(AuthGuard))
}
