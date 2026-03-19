import { BadRequestException } from '@nestjs/common'
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express'
import { diskStorage, memoryStorage } from 'multer'
import { extname } from 'path'
import { v4 as uuidv4 } from 'uuid'

const ALLOWED_FILE_TYPES = new Set([
  // images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/heic',
  'image/heif',

  // video
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
  'video/ogg',

  // audio
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'audio/aac',
  'audio/flac',

  // documents
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/rtf',
  'application/json',
  'application/xml',
  'text/xml',

  // office
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',

  // archives
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-7z-compressed',

  // generic fallback
  'application/octet-stream'
])

export const avatarFileFilter = (req: any, file: any, cb: any) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(
      new BadRequestException(
        'Неподдерживаемый формат файла. Используйте JPEG, PNG, GIF или WEBP'
      ),
      false
    )
  }
}

export const messageFileFilter = (req: any, file: any, cb: any) => {
  if (ALLOWED_FILE_TYPES.has(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new BadRequestException('Неподдерживаемый формат файла.'), false)
  }
}

export const avatarStorage = diskStorage({
  destination: './uploads/avatars',
  filename: (req, file, cb) => {
    const uniqueName = uuidv4()
    const ext = extname(file.originalname)
    cb(null, `${uniqueName}${ext}`)
  }
})

export const messageStorage = diskStorage({
  destination: './uploads/messages',
  filename: (req, file, cb) => {
    const uniqueName = uuidv4()
    const ext = extname(file.originalname)
    cb(null, `${uniqueName}${ext}`)
  }
})

export const avatarFileOptions = {
  storage: avatarStorage,
  fileFilter: avatarFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
}

export const messageFileOptions = {
  storage: memoryStorage(),
  fileFilter: messageFileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB
  }
}

export const UploadAvatar = () => FileInterceptor('avatar', avatarFileOptions)
export const UploadMessage = () =>
  FilesInterceptor('files', 10, messageFileOptions)
