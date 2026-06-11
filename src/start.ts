import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error: any) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    // Log the error to see what's happening
    console.error("SSR Middleware Error details:", error);
    if (error?.stack) console.error("Stack trace:", error.stack);
    
    // For debugging, returning the error message in the response
    const errorMessage = error?.message || "Unknown error";
    
    return new Response(
      `<!DOCTYPE html><html><body><h1>SSR Error</h1><pre>${errorMessage}</pre><pre>${error?.stack}</pre></body></html>`,
      {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      }
    );
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware],
}));
