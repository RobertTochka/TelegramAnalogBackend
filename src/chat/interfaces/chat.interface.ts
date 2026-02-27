export interface IChat {
  id: string
  type: string
  name?: string
  participants: Array<{
    id: string
    username: string
    firstName?: string
    lastName?: string
    avatar?: string
    role: string
    lastReadAt?: Date
  }>
  lastMessage?: {
    id: string
    text?: string
    createdAt: Date
    senderId: string
  }
  unreadCount: number
}
