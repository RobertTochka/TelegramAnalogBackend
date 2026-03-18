import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common'
import { EnumFriendshipStatus, EnumUserRole } from '@prisma/__generated__/enums'

import { Authorization, Authorized } from '@/auth/decorators'

import { ChangePasswordDto, SearchUsersDto, UpdateUserDto } from './dto'
import { UploadAvatar } from './interceptors'
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
  @Get('me')
  public async getUserId(@Authorized('id') userId: string) {
    return userId
  }

  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Get('profile')
  public async getProfile(@Authorized('id') userId: string) {
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
  @Patch('avatar')
  @UseInterceptors(UploadAvatar())
  public async updateAvatar(
    @Authorized('id') userId: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) {
      throw new BadRequestException('Файл не загружен')
    }

    const avatarUrl = `/uploads/avatars/${file.filename}`
    return this.userService.updateAvatar(userId, avatarUrl)
  }

  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Get('profile/:userId')
  public async findProfile(@Param('userId') userId: string) {
    return this.userService.findProfileById(userId)
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
  @Post('friends')
  public async sendFriendRequest(
    @Authorized('id') userId: string,
    @Body() dto: { friendId: string }
  ) {
    return this.userService.sendFriendRequest(userId, dto.friendId)
  }

  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Patch('friends')
  public async patchFriendRequest(
    @Authorized('id') userId: string,
    @Body() dto: { friendId: string; status: EnumFriendshipStatus }
  ) {
    return this.userService.patchFriendRequest(userId, dto.friendId, dto.status)
  }

  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Get('friends')
  public async getFriends(@Authorized('id') userId: string) {
    return this.userService.getFriends(userId)
  }
}
