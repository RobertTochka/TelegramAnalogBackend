import { Type } from 'class-transformer'
import { IsDateString, IsOptional, IsString, Min } from 'class-validator'

export class MessageFilterDto {
  @IsString()
  @IsOptional()
  chatId?: string

  @IsString()
  @IsOptional()
  senderId?: string

  @IsDateString()
  @IsOptional()
  fromDate?: string

  @Type(() => Number)
  @Min(1)
  @IsOptional()
  page?: number = 1

  @Type(() => Number)
  @Min(1)
  @IsOptional()
  limit?: number = 50

  @IsString()
  @IsOptional()
  search?: string
}
