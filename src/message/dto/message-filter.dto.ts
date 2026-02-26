import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator'

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

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 50

  @IsString()
  @IsOptional()
  search?: string
}
