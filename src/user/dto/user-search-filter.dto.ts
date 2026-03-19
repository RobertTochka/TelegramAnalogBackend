import { IsOptional, IsString } from 'class-validator'

export class UserSearchFilterDto {
  @IsString()
  search: string

  @IsString()
  @IsOptional()
  cursor?: string

  @IsString()
  @IsOptional()
  limit?: string
}
