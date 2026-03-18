import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common'
import {
  EnumFriendshipStatus,
  EnumUserStatus
} from '@prisma/__generated__/enums'
import { hash, verify } from 'argon2'
import * as fs from 'fs'
import * as path from 'path'

import { FileService } from '@/file/file.service'
import { PrismaService } from '@/prisma.service'

import {
  ChangePasswordDto,
  CreateUserDto,
  FriendRequestsResponseDto,
  GetFriendsResponseDto,
  SearchUsersDto,
  UpdateUserDto
} from './dto'

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name)

  public constructor(
    private readonly prismaService: PrismaService,
    private readonly fileService: FileService
  ) {}

  async findAll(params: SearchUsersDto) {
    const { query, status, page = 1, limit = 20 } = params

    const users = await this.prismaService.user.findMany({
      where: {
        ...(query && {
          OR: [
            { username: { contains: query, mode: 'insensitive' } },
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } }
          ]
        }),
        ...(status && { status })
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            messages: true,
            chats: true
          }
        }
      }
    })

    const total = await this.prismaService.user.count({
      where: {
        ...(query && {
          OR: [
            { username: { contains: query, mode: 'insensitive' } },
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } }
          ]
        }),
        ...(status && { status })
      }
    })

    return {
      users,
      total
    }
  }

  public async findById(id: string) {
    const user = await this.prismaService.user.findUnique({
      where: {
        id
      },
      include: {
        friendships: {
          where: {
            status: 'ACCEPTED'
          },
          include: {
            friend: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                avatar: true,
                status: true,
                lastSeen: true
              }
            }
          }
        },
        // Друзья, где пользователь является получателем
        friendOf: {
          where: {
            status: 'ACCEPTED'
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                avatar: true,
                status: true,
                lastSeen: true
              }
            }
          }
        }
      }
    })

    if (!user)
      throw new NotFoundException(
        'Пользователь не найден. Пожалуйста, проверьте введенные данные.'
      )

    const friends = [
      ...user.friendships.map(f => f.friend),
      ...user.friendOf.map(f => f.user)
    ]

    const uniqueFriends = Array.from(
      new Map(friends.map(friend => [friend.id, friend])).values()
    )

    return {
      ...user,
      friends: uniqueFriends,
      friendships: undefined,
      friendOf: undefined
    }
  }

  public async findProfileById(id: string) {
    const user = await this.prismaService.user.findUnique({
      where: {
        id
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        description: true,
        avatar: true,
        status: true,
        lastSeen: true,
        friendships: {
          where: {
            status: EnumFriendshipStatus.ACCEPTED
          },
          select: {
            friend: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                avatar: true,
                status: true,
                lastSeen: true
              }
            }
          }
        },
        friendOf: {
          where: {
            status: EnumFriendshipStatus.ACCEPTED
          },
          select: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                avatar: true,
                status: true,
                lastSeen: true
              }
            }
          }
        }
      }
    })

    if (!user)
      throw new NotFoundException(
        'Пользователь не найден. Пожалуйста, проверьте введенные данные.'
      )

    const friends = [
      ...user.friendships.map(f => f.friend),
      ...user.friendOf.map(f => f.user)
    ]

    const uniqueFriends = Array.from(
      new Map(friends.map(friend => [friend.id, friend])).values()
    )

    return {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      description: user.description,
      avatar: user.avatar,
      status: user.status,
      lastSeen: user.lastSeen,
      friends: uniqueFriends
    }
  }

  public async findByEmail(email: string) {
    const user = await this.prismaService.user.findUnique({
      where: {
        email
      }
    })

    return user
  }

  public async create(dto: CreateUserDto) {
    const isExist = await this.prismaService.user.findUnique({
      where: {
        email: dto.email
      }
    })

    if (isExist)
      throw new ConflictException('Пользователь с таким email уже существует')

    const user = await this.prismaService.user.create({
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName
      }
    })

    return user
  }

  public async update(userId: string, dto: UpdateUserDto) {
    const user = await this.prismaService.user.findUnique({
      where: {
        id: userId
      }
    })

    if (!user)
      throw new NotFoundException(
        'Пользователь не найден. Пожалуйста, проверьте введенные данные.'
      )

    if (dto.username) {
      const isExist = await this.prismaService.user.findUnique({
        where: {
          username: dto.username
        }
      })
      if (isExist)
        throw new ConflictException(
          'Пользователь с таким username уже существует'
        )
    }

    const data = { ...user, ...dto }

    const updatedUser = await this.prismaService.user.update({
      where: {
        id: user.id
      },
      data: data
    })

    return updatedUser
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      throw new NotFoundException('Пользователь не найден')
    }

    if (user.avatar && !user.avatar.includes('no-user-image.png')) {
      await this.fileService.deleteFile(user.avatar)
    }

    const updatedUser = await this.prismaService.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl }
    })

    return updatedUser
  }

  public async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.findById(userId)

    if (!user) throw new NotFoundException('Пользователь не найден.')

    if (user.password && !dto.oldPassword)
      throw new BadRequestException('Введите старый пароль.')

    const isPasswordsMatching = await verify(user.password, dto.oldPassword)

    if (user.password && !isPasswordsMatching)
      throw new BadRequestException('Введен неверный пароль.')

    const newPassword = await hash(dto.password)

    await this.prismaService.user.update({
      where: {
        id: userId
      },
      data: {
        password: newPassword
      }
    })
  }

  public async updateUserStatus(userId: string, status: EnumUserStatus) {
    await this.prismaService.user.update({
      where: { id: userId },
      data: {
        status,
        lastSeen: new Date()
      }
    })
  }

  public async getUsersStatuses(
    userIds: string[],
    userSockets: Map<string, Set<string>>
  ) {
    if (userIds.length === 0) {
      return {}
    }

    const uniqueUserIds = [...new Set(userIds)]

    const usersFromDb = await this.prismaService.user.findMany({
      where: {
        id: { in: uniqueUserIds }
      },
      select: {
        id: true,
        status: true,
        lastSeen: true
      }
    })

    const dbUsersMap = new Map(
      usersFromDb.map(user => [
        user.id,
        {
          status: user.status,
          lastSeen: user.lastSeen
        }
      ])
    )

    const result: Record<
      string,
      { status: EnumUserStatus; lastSeen: Date | null }
    > = {}

    for (const userId of uniqueUserIds) {
      const isOnline =
        userSockets.has(userId) && userSockets.get(userId)!.size > 0

      if (isOnline) {
        result[userId] = {
          status: 'ONLINE',
          lastSeen: new Date()
        }
      } else {
        const dbUser = dbUsersMap.get(userId)

        result[userId] = dbUser || {
          status: 'OFFLINE',
          lastSeen: new Date()
        }
      }
    }

    return result
  }

  //#region friends

  // Отправить запрос в друзья
  public async sendFriendRequest(userId: string, friendId: string) {
    this.logger.log('1')
    if (userId === friendId) {
      throw new ConflictException('Нельзя добавить самого себя в друзья')
    }

    const friend = await this.prismaService.user.findUnique({
      where: { id: friendId }
    })

    if (!friend) {
      throw new NotFoundException('Пользователь не найден')
    }

    const existingFriendship = await this.prismaService.friendship.findUnique({
      where: {
        userId_friendId: {
          userId,
          friendId
        }
      }
    })

    if (existingFriendship) {
      throw new ConflictException('Пользователь уже в друзьях')
    }

    await this.prismaService.friendship.create({
      data: {
        userId,
        friendId,
        status: EnumFriendshipStatus.PENDING
      },
      include: {
        friend: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        }
      }
    })
  }

  // Принять запрос в друзья
  async patchFriendRequest(
    userId: string,
    friendId: string,
    status: EnumFriendshipStatus
  ) {
    await this.prismaService.friendship.update({
      where: {
        userId_friendId: {
          userId: friendId, // Тот, кто отправил запрос
          friendId: userId // Тот, кто принимает
        }
      },
      data: {
        status
      }
    })
  }

  // Получить список друзей пользователя
  async getFriends(userId: string): Promise<GetFriendsResponseDto> {
    const friendships = await this.prismaService.friendship.findMany({
      where: {
        OR: [
          { userId, status: EnumFriendshipStatus.ACCEPTED },
          { friendId: userId, status: EnumFriendshipStatus.ACCEPTED }
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            description: true,
            avatar: true,
            status: true,
            lastSeen: true
          }
        },
        friend: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            description: true,
            avatar: true,
            status: true,
            lastSeen: true
          }
        }
      }
    })

    const friends = friendships.map(f =>
      f.userId === userId ? f.friend : f.user
    )
    const friendRequests = await this.getFriendRequests(userId)

    return { friends, friendRequests }
  }

  // Удалить из друзей / отклонить запрос
  async removeFriend(userId: string, friendId: string) {
    const friendship = await this.prismaService.friendship.findFirst({
      where: {
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId }
        ]
      }
    })

    if (!friendship) {
      throw new Error('Дружба не найдена')
    }

    return this.prismaService.friendship.delete({
      where: {
        id: friendship.id
      }
    })
  }

  //#region private methods

  // Получить все запросы в друзья
  private async getFriendRequests(
    userId: string
  ): Promise<FriendRequestsResponseDto> {
    const incomingFriendships = await this.prismaService.friendship.findMany({
      where: {
        friendId: userId,
        status: EnumFriendshipStatus.PENDING
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            description: true,
            firstName: true,
            lastName: true,
            avatar: true,
            status: true,
            lastSeen: true
          }
        }
      }
    })

    const outgoingFriendships = await this.prismaService.friendship.findMany({
      where: {
        userId,
        status: EnumFriendshipStatus.PENDING
      },
      include: {
        friend: {
          select: {
            id: true,
            username: true,
            description: true,
            firstName: true,
            lastName: true,
            avatar: true,
            status: true,
            lastSeen: true
          }
        }
      }
    })

    const incomingRequests = incomingFriendships.map(f => f.user)
    const outgoingRequests = outgoingFriendships.map(f => f.friend)

    const requests: FriendRequestsResponseDto = {
      incomingRequests,
      outgoingRequests
    }

    return requests
  }
}
