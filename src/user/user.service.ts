import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import { hash, verify } from 'argon2'

import { PrismaService } from '@/prisma.service'

import {
  ChangePasswordDto,
  CreateUserDto,
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
}
