import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import uploadConfig from '@/config/upload.config'

import { FileService } from './file.service'

@Global()
@Module({
  imports: [ConfigModule.forFeature(uploadConfig)],
  providers: [FileService],
  exports: [FileService]
})
export class FileModule {}
