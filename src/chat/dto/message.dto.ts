import { Expose, Type } from 'class-transformer'

import { SenderDto } from '@/message/dto'

export class MessageDto {
  @Expose()
  id: string

  @Expose()
  chatId: string

  @Expose()
  sender?: SenderDto

  @Expose()
  content: string

  @Expose()
  isSystem: boolean

  @Expose()
  @Type(() => MessageDto)
  replyTo?: MessageDto

  @Expose()
  @Type(() => MessageDto)
  forwardedFrom?: MessageDto

  @Expose()
  createdAt: Date
}
