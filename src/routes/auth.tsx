import { createFileRoute } from '@tanstack/react-router'
import AuthPage from './auth.index'

export const Route = createFileRoute('/auth')({
  component: AuthPage,
})
