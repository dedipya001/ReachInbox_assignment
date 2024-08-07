// types.d.ts
import session from 'express-session';

declare module 'express-session' {
  interface SessionData {
    tokens: {
      access_token?: string | null;
      refresh_token?: string | null;
      scope?: string | null;
      token_type?: string | null;
      expiry_date?: number | null;
    };
  }
}
