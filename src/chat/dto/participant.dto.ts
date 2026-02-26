import { EnumMemberRole } from '@prisma/__generated__/enums'
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
  joinedAt: Date

  @Expose()
  lastReadAt?: Date
}
