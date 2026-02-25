import { Body, Heading, Link, Tailwind, Text } from '@react-email/components'
import { Html } from '@react-email/html'
import * as React from 'react'

export function ConfirmationTemplate(token: string) {
  return token
  // return (
  //   <Tailwind>
  //       <Html>
  //           <Body className="text-black">
  //               <Heading>Подтверждение почты</Heading>
  //               <Text>
  //                   Здравствуйте! Чтобы подтвердить свой адрес электронной почты, пожалуйста, перейдите по следующей ссылке:
  //               </Text>
  //               <Text>Ваш код подтверждения: {token}</Text>
  //               <Text>Эта ссылка действительна в течение 1 часа. Если вы не запрашивали подтверждение, просто проигнорируйте это сообщение.</Text>
  //               <Text>Спасибо за использование нашего сервиса!</Text>
  //           </Body>
  //       </Html>
  //   </Tailwind>
  // )
}
