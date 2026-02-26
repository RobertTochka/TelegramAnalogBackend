import { Expose } from 'class-transformer'

export class SenderDto {
  @Expose()
  id: string

  @Expose()
  firstName?: string

  @Expose()
  lastName?: string

  @Expose()
  avatar?: string
}
