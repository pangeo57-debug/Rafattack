import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      platformRole: string;
      businessId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    platformRole?: string;
    businessId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    platformRole?: string;
    businessId?: string | null;
  }
}
