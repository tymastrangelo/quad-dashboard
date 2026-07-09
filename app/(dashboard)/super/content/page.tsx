"use client";

import { useState } from "react";
import { supabase } from "@/lib/api";
import type { ClubSubmission } from "@/lib/types";
import { useData } from "@/lib/useData";
import { Tabs } from "@/components/ui";
import { ClubsTab } from "./ClubsTab";
import { EventsTab } from "./EventsTab";
import { PostsTab } from "./PostsTab";
import { SubmissionsTab } from "./SubmissionsTab";

export default function ContentPage() {
  const [tab, setTab] = useState("clubs");

  const submissions = useData("club-submissions", async () => {
    const { data, error } = await supabase
      .from("club_submissions")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data as ClubSubmission[];
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-bold">Content</h1>
          <p className="text-sm text-subtle">Manage clubs, events, posts, and club registrations</p>
        </div>
        <Tabs
          tabs={[
            { key: "clubs", label: "Clubs" },
            { key: "events", label: "Events" },
            { key: "posts", label: "Posts" },
            { key: "submissions", label: "Submissions", count: submissions.data?.length },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>
      {tab === "clubs" && <ClubsTab />}
      {tab === "events" && <EventsTab />}
      {tab === "posts" && <PostsTab />}
      {tab === "submissions" && (
        <SubmissionsTab
          submissions={submissions.data ?? []}
          loading={submissions.loading}
          onChanged={submissions.refresh}
        />
      )}
    </div>
  );
}
