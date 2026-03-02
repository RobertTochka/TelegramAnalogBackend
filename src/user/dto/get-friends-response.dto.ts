import { EnumUserStatus } from '@prisma/__generated__/enums'

import { FriendRequestsResponseDto } from './friend-requests-response.dto'
import { UserDto } from './user.dto'

export class GetFriendsResponseDto {
  friends: UserDto[]
  friendRequests: FriendRequestsResponseDto
}
