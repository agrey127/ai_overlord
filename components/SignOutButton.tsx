"use client";

import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export default function SignOutButton() {
  const router = useRouter();
  return <button type="button" onClick={async () => {
    await getBrowserSupabase().auth.signOut();
    router.replace("/login");
    router.refresh();
  }}>Sign out</button>;
}
