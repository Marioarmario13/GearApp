import { useAuth } from "@/auth/AuthProvider";
import { AccountScreen } from "@/screens/AccountScreen";

export default function AccountRoute() {
  const { session } = useAuth();
  if (!session) return null;
  return <AccountScreen userId={session.user.id} email={session.user.email ?? null} />;
}
