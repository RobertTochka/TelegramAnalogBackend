import { EnumMemberRole, EnumUserStatus } from '@prisma/__generated__/enums'
import { Expose } from 'class-transformer'

export class ParticipantDto {
  @Expose()
  id: string

  @Expose()
  username: string

  @Expose()
  firstName?: string

  @Expose()
  lastName?: string

  @Expose()
  avatar?: string

  @Expose()
  role: EnumMemberRole

  @Expose()
  status: EnumUserStatus

  @Expose()
  lastSeen: Date

  @Expose()
  joinedAt: Date

  @Expose()
  lastReadAt?: Date
}
