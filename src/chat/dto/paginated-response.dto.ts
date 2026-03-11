export class PaginatedResponse<T> {
  data: T
  meta: {
    total: number
    limit: number
    nextCursor: string | null
    hasNextPage: boolean
  }
}
