import { Expose } from 'class-transformer'

export class LastMessageDto {
  @Expose()
  id: string

  @Expose()
  content?: string

  @Expose()
  createdAt: Date

  @Expose()
  senderId: string

  @Expose()
  sender?: {
    id: string
    username: string
    firstName?: string
    lastName?: string
  }
}
