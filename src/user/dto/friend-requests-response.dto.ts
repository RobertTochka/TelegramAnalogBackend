import { Friendship } from '@prisma/__generated__/client'

export class FriendRequestsResponseDto {
  incomingRequests: ({
    user: {
      id: string
      firstName: string
      lastName: string
      avatar: string
    }
  } & Friendship)[]

  outgoingRequests: ({
    friend: {
      id: string
      firstName: string
      lastName: string
      avatar: string
    }
  } & Friendship)[]
}
