"use client";

import { ActivityFeed } from "@/components/activity-feed";
import { ConnectGate } from "@/components/shell";
import { Card } from "@/components/ui";
import { useAllActivity, useMyGroups } from "@/lib/savora/hooks";
import { DEMO, DEMO_LABELS } from "@/lib/savora/demo";
import { useConnection } from "@/lib/savora/use-savora";

export default function ActivityTab() {
  const { authenticated, ready, address } = useConnection();
  const groups = useMyGroups(address);
  const activity = useAllActivity(groups.data);

  if (!ready) return null;
  if (!authenticated) return <ConnectGate />;
  if (groups.isLoading || activity.isLoading)
    return <p className="text-[13px] text-ink-muted">Loading…</p>;

  if (activity.events.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-[13px] text-ink-muted">
          Nothing has happened in your circles yet.
        </p>
      </Card>
    );
  }

  // In demo the single fixture circle's members map to DEMO_LABELS by index.
  const labels = DEMO ? DEMO_LABELS : undefined;

  return (
    <section>
      <h2 className="micro mb-2.5">Everything, newest first</h2>
      <ActivityFeed events={activity.events} labels={labels} />
    </section>
  );
}
