// Test helpers for the platform shell.
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { render, type RenderResult } from '@testing-library/react';
import { createAppRouter } from '../router';
import { usePlatform } from '../store';

export function resetStore(): void {
  usePlatform.setState({
    connection: 'online',
    session: null,
    match: null,
    presence: null,
    pendingPresence: null,
    siteAccess: 'open',
    account: 'off',
  });
}

/** Renders the site at `path` (the real routes, on a memory history). */
export async function renderAt(
  path: string,
): Promise<RenderResult & { router: ReturnType<typeof createAppRouter> }> {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  await router.load();
  return { router, ...render(<RouterProvider router={router} />) };
}
