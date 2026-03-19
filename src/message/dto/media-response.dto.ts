import { EnumMediaType } from '@prisma/__generated__/enums'
import { Expose } from 'class-transformer'

export class MediaResponseDto {
  @Expose()
  id: string

  @Expose()
  type: EnumMediaType

  @Expose()
  url: string

  @Expose()
  fileName?: string

  @Expose()
  fileSize?: number

  @Expose()
  createdAt: Date

  @Expose()
  safeName: string
}
