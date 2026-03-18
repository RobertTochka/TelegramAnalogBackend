import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as fs from 'fs'
import * as path from 'path'

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name)

  constructor(private configService: ConfigService) {}

  validateFile(file: Express.Multer.File, type: 'avatar' | 'message') {
    const config = this.configService.get(`upload.${type}`)

    if (!config) {
      throw new BadRequestException(`Неизвестный тип файла: ${type}`)
    }

    if (file.size > config.maxSize) {
      throw new BadRequestException(
        `Файл слишком большой. Максимальный размер: ${config.maxSize / 1024 / 1024}MB`
      )
    }

    if (!config.allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Неподдерживаемый формат файла. Разрешенные форматы: ${config.allowedMimes.join(', ')}`
      )
    }

    return true
  }

  async deleteFile(filePath: string) {
    try {
      const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath
      const fullPath = path.join(process.cwd(), cleanPath)

      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath)
        this.logger.log(`Файл удален: ${fullPath}`)
      }
    } catch (error) {
      this.logger.error(`Ошибка при удалении файла: ${error.message}`)
    }
  }

  async deleteFileByUrl(fileUrl: string, type: 'avatar' | 'message') {
    try {
      const config = this.configService.get(`upload.${type}`)
      const filename = path.basename(fileUrl)
      const fullPath = path.join(process.cwd(), config.destination, filename)

      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath)
        this.logger.log(`Файл удален: ${fullPath}`)
      }
    } catch (error) {
      this.logger.error(`Ошибка при удалении файла: ${error.message}`)
    }
  }

  getFileUrl(filename: string, type: 'avatar' | 'message'): string {
    const config = this.configService.get(`upload.${type}`)
    return `${config.urlPrefix}${filename}`
  }

  async saveFile(
    file: Express.Multer.File,
    type: 'avatar' | 'message'
  ): Promise<string> {
    this.validateFile(file, type)
    return this.getFileUrl(file.filename, type)
  }
}
