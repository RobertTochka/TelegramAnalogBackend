import { PartialType, PickType } from '@nestjs/mapped-types'

import { CreateChatDto } from './create-chat.dto'

export class UpdateChatDto extends PartialType(
  PickType(CreateChatDto, [
    'name',
    'description',
    'avatar',
    'isPrivate'
  ] as const)
) {}
