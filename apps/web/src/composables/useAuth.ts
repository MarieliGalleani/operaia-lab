import { authSession } from "@/modules/auth/auth-session";

export function useAuth() {
  return authSession;
}
