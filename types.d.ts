// types.d.ts
import session from 'express-session';

declare module 'express-session' {
  interface SessionData {
    googleTokens: {
      access_token?: string | undefined | null;
      refresh_token?: string | undefined | null;
      scope?: string | undefined;
      token_type?: string | undefined  | null;
      expiry_date?: number | undefined  | null;
    };
    outlookToken?: string;
  }
}
