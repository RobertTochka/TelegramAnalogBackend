import { EnumUserStatus } from '@prisma/__generated__/enums'
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator'

export class SearchUsersDto {
  @IsString()
  @MinLength(2)
  @IsOptional()
  query?: string

  @IsEnum(EnumUserStatus)
  @IsOptional()
  status?: EnumUserStatus

  @IsOptional()
  page?: number = 1

  @IsOptional()
  limit?: number = 20
}
