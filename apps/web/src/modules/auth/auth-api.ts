import {
  createHttpClient,
  resolveApiRootUrl,
  type HttpClient,
} from "@/data/adapters/http-client";

export interface AdminIdentity {
  readonly id: string;
  readonly login: string;
  readonly role: "ADMIN";
}

export interface LoginCredentials {
  readonly login: string;
  readonly password: string;
}

export interface AuthApi {
  login(credentials: LoginCredentials): Promise<void>;
  me(): Promise<AdminIdentity>;
  logout(): Promise<void>;
}

export function createAuthApi(
  client: HttpClient = createHttpClient(resolveApiRootUrl(), {
    notifyUnauthorized: false,
  }),
): AuthApi {
  return {
    async login(credentials): Promise<void> {
      await client.post<{ user: AdminIdentity }>("/api/auth/login", credentials);
    },
    async me(): Promise<AdminIdentity> {
      const response = await client.get<{ user: AdminIdentity }>("/api/auth/me");
      return response.user;
    },
    async logout(): Promise<void> {
      await client.post<void>("/api/auth/logout", {});
    },
  };
}
