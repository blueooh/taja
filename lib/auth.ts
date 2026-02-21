export interface AuthUser {
  id: string
  username: string
  nickname: string
  isSocial?: boolean
}

export const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/
export const NICKNAME_REGEX = /^[a-zA-Z0-9가-힣_]{1,20}$/
export const PASSWORD_MIN = 6
export const PASSWORD_MAX = 50
