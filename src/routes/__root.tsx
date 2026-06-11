import { createRootRoute, Outlet, ScrollRestoration, Meta, Scripts, Head } from '@tanstack/react-router'
import '@/styles.css'

export const Route = createRootRoute({
  component: () => (
    <html lang="pt-BR" className="dark">
      <Head>
        <Meta />
        <title>Flux Post</title>
      </Head>
      <body className="bg-background text-foreground font-sans antialiased">
        <div id="root-layout">
          <Outlet />
        </div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  ),
})
