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

  @IsString()
  @IsOptional()
  cursor?: string

  @Type(() => Number)
  @Min(1)
  @IsOptional()
  limit?: number = 50

  @IsString()
  @IsOptional()
  search?: string
}
