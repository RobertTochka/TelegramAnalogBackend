import { MessageResponseDto } from './message-response.dto'

export class MessagePositionResponseDto {
  message: MessageResponseDto
  page: number
  indexInPage: number
  totalBefore: number
  totalCount: number
}
