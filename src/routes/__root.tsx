import { createRootRoute, Outlet, ScrollRestoration, Scripts } from '@tanstack/react-router'
import '@/styles.css'

export const Route = createRootRoute({
  meta: () => [
    {
      title: 'Flux Post',
    },
    {
      charSet: 'utf-8',
    },
    {
      name: 'viewport',
      content: 'width=device-width, initial-scale=1',
    },
  ],
  component: () => (
    <div id="root-layout" className="dark bg-background text-foreground min-h-screen font-sans antialiased">
      <Outlet />
      <ScrollRestoration />
      <Scripts />
    </div>
  ),
})
