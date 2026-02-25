import { Injectable } from '@nestjs/common'
import { PrismaClient } from '@prisma/__generated__/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    const connectionString = process.env.POSTGRES_URI
    const adapter = new PrismaPg({ connectionString })
    super({ adapter })
  }
}
