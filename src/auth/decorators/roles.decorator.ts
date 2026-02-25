import { SetMetadata } from '@nestjs/common'
import { EnumUserRole } from '@prisma/__generated__/enums'

export const ROLES_KEY = 'roles'

export const Roles = (...roles: EnumUserRole[]) => SetMetadata(ROLES_KEY, roles)
