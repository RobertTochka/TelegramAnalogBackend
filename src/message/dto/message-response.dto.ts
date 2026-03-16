import { EnumMessageStatus } from '@prisma/__generated__/enums'
import { Expose, Type } from 'class-transformer'

import { MediaResponseDto } from './media-response.dto'
import { SenderDto } from './sender.dto'

export class MessageResponseDto {
  @Expose()
  id: string

  @Expose()
  chatId: string

  @Expose()
  @Type(() => SenderDto)
  sender?: SenderDto

  @Expose()
  content?: string

  @Expose()
  isSystem: boolean

  @Expose()
  @Type(() => MessageResponseDto)
  replyTo?: MessageResponseDto

  @Expose()
  @Type(() => MessageResponseDto)
  forwardedFrom?: MessageResponseDto

  @Expose()
  @Type(() => MediaResponseDto)
  media: MediaResponseDto[]

  @Expose()
  statuses: Record<string, EnumMessageStatus> // Статусы для разных пользователей

  @Expose()
  createdAt: Date

  @Expose()
  isEdited: boolean

  @Expose()
  viewsCount: number
}
