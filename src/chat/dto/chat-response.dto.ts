import { EnumChatType } from '@prisma/__generated__/enums'
import { Expose, Type } from 'class-transformer'

import { InviteLinkDto } from './invite-link.dto'
import { MessageDto } from './message.dto'
import { ParticipantDto } from './participant.dto'

export class ChatResponseDto {
  @Expose()
  id: string

  @Expose()
  type: EnumChatType

  @Expose()
  name?: string

  @Expose()
  description?: string

  @Expose()
  avatar?: string

  @Expose()
  createdById: string

  @Expose()
  @Type(() => ParticipantDto)
  createdBy?: ParticipantDto

  @Expose()
  isPrivate: boolean

  @Expose()
  @Type(() => InviteLinkDto)
  inviteLink?: InviteLinkDto

  @Expose()
  @Type(() => ParticipantDto)
  participants: ParticipantDto[]

  @Expose()
  @Type(() => MessageDto)
  lastMessage?: MessageDto

  @Expose()
  @Type(() => MessageDto)
  pinnedMessage?: MessageDto

  @Expose()
  unreadCount?: number

  @Expose()
  createdAt: Date

  @Expose()
  updatedAt: Date

  @Expose()
  participantCount: number

  @Expose()
  isArchived: boolean

  @Expose()
  isMuted: boolean

  @Expose()
  isPinned: boolean
}
