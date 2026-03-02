import { Expose } from 'class-transformer'

import { SenderDto } from '@/message/dto'

export class MessageDto {
  @Expose()
  id: string

  @Expose()
  content: string

  @Expose()
  createdAt: Date

  @Expose()
  sender?: SenderDto
}
