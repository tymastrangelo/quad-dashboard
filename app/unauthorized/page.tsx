"use client";

import { useRouter } from "next/navigation";
import { IoShieldOutline } from "react-icons/io5";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";

export default function UnauthorizedPage() {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-card border border-hairline bg-card p-8 text-center">
        <IoShieldOutline size={40} className="mx-auto text-gold" />
        <h1 className="mt-4 text-lg font-bold">This dashboard is for authorized staff</h1>
        <p className="mt-2 text-sm text-subtle">
          Your account isn&apos;t on the admin list for the Quad dashboard. If you think
          this is a mistake, contact the app owner.
        </p>
        <Button
          variant="primary"
          className="mt-6"
          onClick={async () => {
            await createClient().auth.signOut();
            router.push("/login");
            router.refresh();
          }}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}
