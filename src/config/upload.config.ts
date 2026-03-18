import { registerAs } from '@nestjs/config'

export default registerAs('upload', () => ({
  avatar: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedMimes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    destination: './uploads/avatars',
    urlPrefix: '/uploads/avatars/'
  },
  message: {
    maxSize: 20 * 1024 * 1024, // 20MB
    allowedMimes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/webm',
      'audio/mpeg',
      'audio/ogg',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
    destination: './uploads/messages',
    urlPrefix: '/uploads/messages/'
  }
}))
