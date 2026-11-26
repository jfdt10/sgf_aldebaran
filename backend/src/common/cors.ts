const defaultOrigins = ['https://aldebaran-frontend.pages.dev', 'http://localhost:4200'];

export function allowApplicationOrigin(origin: string | undefined, done: (error: Error | null, allowed: boolean) => void) {
  const configured = process.env.CORS_ORIGINS?.split(',').map((value) => value.trim()) ?? [];
  const allowed = origin !== undefined && (
    [...defaultOrigins, ...configured].includes(origin) ||
    /^https:\/\/[a-z0-9-]+\.aldebaran-frontend\.pages\.dev$/.test(origin)
  );
  done(null, allowed);
}
