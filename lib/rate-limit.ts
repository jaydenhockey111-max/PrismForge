import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function checkRateLimit({ key, limit, windowSeconds }: { key: string; limit: number; windowSeconds: number }) {
  try {
    const admin = createAdminClient() as any;
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      const missingFunction = error.code === "42883" || error.code === "PGRST202" || String(error.message ?? "").includes("check_rate_limit");
      if (missingFunction) return true;
      throw error;
    }
    return data === true;
  } catch {
    // Fail open so a monitoring/migration issue does not lock out legitimate users.
    return true;
  }
}
