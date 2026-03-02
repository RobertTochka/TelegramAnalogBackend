import { UserDto } from './user.dto'

export class FriendRequestsResponseDto {
  incomingRequests: UserDto[]
  outgoingRequests: UserDto[]
}
