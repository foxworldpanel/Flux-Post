import { createRootRoute, Outlet, ScrollRestoration, Scripts } from '@tanstack/react-router'
import '@/styles.css'

export const Route = createRootRoute({
  component: () => (
    <div id="root-layout" className="dark bg-background text-foreground min-h-screen font-sans antialiased">
      <Outlet />
      <ScrollRestoration />
      <Scripts />
    </div>
  ),
})
