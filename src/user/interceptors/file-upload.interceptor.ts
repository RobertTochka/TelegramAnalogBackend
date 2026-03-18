import { BadRequestException } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname } from 'path'
import { v4 as uuidv4 } from 'uuid'

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

export const avatarStorage = diskStorage({
  destination: './uploads/avatars',
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

export const UploadAvatar = () => FileInterceptor('avatar', avatarFileOptions)
