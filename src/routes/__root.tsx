import { createRootRoute, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => (
    <div id="root-layout">
      <Outlet />
    </div>
  ),
})
