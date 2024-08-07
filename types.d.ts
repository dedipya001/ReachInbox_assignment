// types.d.ts
import session from 'express-session';

declare module 'express-session' {
  interface SessionData {
    tokens: {
      access_token?: string | undefined;
      refresh_token?: string | undefined;
      scope?: string | undefined;
      token_type?: string | undefined;
      expiry_date?: number | undefined;
    };
  }
}
