import { fail, type GearheadClient } from "./data-core";

export interface AccountSuspension {
  user_id: string;
  username: string | null;
  display_name: string | null;
  reason: string;
  suspended_at: string;
  suspended_by_username: string | null;
}

/** Suspende a conta (admin): encerra sessões e localização; login e API passam a recusar. */
export async function adminSuspendUser(client: GearheadClient, userId: string, reason: string) {
  const { error } = await client.rpc("admin_suspend_user", {
    p_user_id: userId,
    p_reason: reason,
  });
  if (error) fail(error);
}

export async function adminUnsuspendUser(client: GearheadClient, userId: string, note: string) {
  const { error } = await client.rpc("admin_unsuspend_user", { p_user_id: userId, p_note: note });
  if (error) fail(error);
}

export async function adminListSuspensions(client: GearheadClient): Promise<AccountSuspension[]> {
  const { data, error } = await client.rpc("admin_list_suspensions");
  if (error) fail(error);
  return data;
}
