import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query
} from '@nestjs/common'
import { EnumUserRole } from '@prisma/__generated__/enums'

import { Authorization, Authorized } from '@/auth/decorators'

import { ChangePasswordDto, SearchUsersDto, UpdateUserDto } from './dto'
import { UserService } from './user.service'

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Authorization(EnumUserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Get()
  async findAll(@Query() searchParams: SearchUsersDto) {
    return this.userService.findAll(searchParams)
  }

  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Get('profile')
  public async findProfile(@Authorized('id') userId: string) {
    return this.userService.findById(userId)
  }

  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Patch('profile')
  public async updateProfile(
    @Authorized('id') userId: string,
    @Body() dto: UpdateUserDto
  ) {
    return this.userService.update(userId, dto)
  }

  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Patch('change-password')
  public async changePassword(
    @Authorized('id') userId: string,
    @Body() dto: ChangePasswordDto
  ) {
    return this.userService.changePassword(userId, dto)
  }

  //#region friends

  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Post('friends/add/:friendId')
  public async sendFriendRequest(
    @Authorized('id') userId: string,
    @Param('friendId') friendId: string
  ) {
    return this.userService.sendFriendRequest(userId, friendId)
  }

  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Post('friends/accept/:friendId')
  public async acceptFriendRequest(
    @Authorized('id') userId: string,
    @Param('friendId') friendId: string
  ) {
    return this.userService.acceptFriendRequest(userId, friendId)
  }

  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Get('friends/list')
  public async getFriends(@Authorized('id') userId: string) {
    return this.userService.getFriends(userId)
  }

  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Get('friends/requests')
  public async getFriendRequests(@Authorized('id') userId: string) {
    return this.userService.getFriendRequests(userId)
  }
}
