import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import { EnumFriendshipStatus } from '@prisma/__generated__/enums'
import { hash, verify } from 'argon2'

import { PrismaService } from '@/prisma.service'

import {
  ChangePasswordDto,
  CreateUserDto,
  FriendRequestsResponseDto,
  SearchUsersDto,
  UpdateUserDto
} from './dto'

@Injectable()
export class UserService {
  public constructor(private readonly prismaService: PrismaService) {}

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
      }
    })

    if (!user)
      throw new NotFoundException(
        'Пользователь не найден. Пожалуйста, проверьте введенные данные.'
      )

    return user
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
    const user = await this.findById(userId)

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

  //#region friends

  // Отправить запрос в друзья
  public async sendFriendRequest(userId: string, friendId: string) {
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

    const friendship = await this.prismaService.friendship.create({
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

    return friendship
  }

  // Принять запрос в друзья
  async acceptFriendRequest(userId: string, friendId: string) {
    return this.prismaService.friendship.update({
      where: {
        userId_friendId: {
          userId: friendId, // Тот, кто отправил запрос
          friendId: userId // Тот, кто принимает
        }
      },
      data: {
        status: EnumFriendshipStatus.ACCEPTED
      }
    })
  }

  // Получить список друзей пользователя
  async getFriends(userId: string) {
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
            firstName: true,
            lastName: true,
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
            avatar: true,
            status: true,
            lastSeen: true
          }
        }
      }
    })

    return friendships.map(f => (f.userId === userId ? f.friend : f.user))
  }

  // Получить все запросы в друзья
  async getFriendRequests(userId: string) {
    const incomingRequests = await this.prismaService.friendship.findMany({
      where: {
        friendId: userId,
        status: EnumFriendshipStatus.PENDING
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        }
      }
    })

    const outgoingRequests = await this.prismaService.friendship.findMany({
      where: {
        userId,
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

    const requests: FriendRequestsResponseDto = {
      incomingRequests,
      outgoingRequests
    }

    return requests
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
}
