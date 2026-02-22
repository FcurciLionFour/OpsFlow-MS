import 'express';
import type { AuthenticatedUserContext } from 'src/auth/auth-context.util';

declare module 'express' {
  interface Request {
    user?: AuthenticatedUserContext;
    requestId?: string;
  }
}
