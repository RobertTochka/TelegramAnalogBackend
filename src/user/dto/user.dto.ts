import { EnumUserStatus } from '@prisma/__generated__/enums'

export class UserDto {
  id: string
  username?: string
  firstName: string
  lastName: string
  description?: string
  avatar: string
  status: EnumUserStatus
  lastSeen: Date
}
