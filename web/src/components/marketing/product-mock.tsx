import type { Address } from "@solana/kit";

import { ActivityFeed } from "@/components/activity-feed";
import { PoolMeter } from "@/components/pool-meter";
import { RosterList } from "@/components/roster-list";
import { RotationTrack } from "@/components/rotation-track";
import { deriveActivity } from "@/lib/savora/activity";
import {
  DEMO_CYCLE,
  DEMO_GROUP,
  DEMO_HISTORY,
  DEMO_LABELS,
  DEMO_ME,
} from "@/lib/savora/demo";
import { decodeName, formatUsdc } from "@/lib/savora/format";

/**
 * Not a screenshot and not a drawing — the actual app components, fed the
 * fixture circle. It reads as a real product because it *is* the product, and
 * it can never drift from what /g/[address] renders.
 *
 * `variant` picks which slice of the surface to show.
 */
export function ProductMock({
  variant = "circle",
  className = "",
}: {
  variant?: "circle" | "contribute";
  className?: string;
}) {
  const g = DEMO_GROUP.data;
  const members = g.members.slice(0, g.memberCount) as Address[];
  const target = g.contribution * BigInt(g.memberCount);
  const events = deriveActivity(DEMO_GROUP, DEMO_HISTORY).slice(0, 4);

  return (
    <div
      className={`overflow-hidden rounded-panel border border-line bg-surface shadow-3 ${className}`}
    >
      {/* app chrome */}
      <div className="flex items-center gap-2 border-b border-line bg-raised px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="addr ml-3 truncate text-[11px] text-ink-faint">
          savora.app/g/{DEMO_GROUP.address.slice(0, 8)}…
        </span>
      </div>

      <div className="flex flex-col gap-6 p-6 sm:p-7">
        <header>
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-[24px] leading-tight text-ink">
              {decodeName(g.name)}
            </h3>
            <span className="rounded-pill border border-line px-2 py-0.5 text-[11px] text-ink-muted">
              Active
            </span>
          </div>
          <p className="tnum mt-1 text-[12px] text-ink-muted">
            {formatUsdc(g.contribution)} USDC per round · {g.memberCount}/
            {g.capacity} seats · round {g.currentCycle + 1} of {g.memberCount}
          </p>
        </header>

        {variant === "contribute" ? (
          <div className="rounded-card border border-line bg-raised p-5">
            <span className="micro">Your move</span>
            <p className="mt-2 text-[14px] text-ink">
              Contribute {formatUsdc(g.contribution)} USDC for round{" "}
              {g.currentCycle + 1}
            </p>
            <div className="mt-3 inline-flex h-9 items-center rounded-control bg-accent px-4 text-[13px] font-medium text-accent-contrast">
              Contribute {formatUsdc(g.contribution)} USDC
            </div>
          </div>
        ) : null}

        <div className="rounded-card border border-line bg-raised p-5">
          <PoolMeter
            pooled={DEMO_CYCLE.data.pooled}
            target={target}
            paidCount={DEMO_CYCLE.data.contributorCount}
            memberCount={g.memberCount}
          />
        </div>

        <div>
          <h4 className="micro mb-2.5">Rotation</h4>
          <RotationTrack
            members={members}
            rotation={g.rotation}
            memberCount={g.memberCount}
            currentCycle={g.currentCycle}
            status={g.status}
            me={DEMO_ME}
            labels={DEMO_LABELS}
          />
        </div>

        <RosterList
          members={members}
          rotation={g.rotation}
          missed={g.missed}
          memberCount={g.memberCount}
          status={g.status}
          currentCycle={g.currentCycle}
          me={DEMO_ME}
          contributedMask={DEMO_CYCLE.data.contributed}
          labels={DEMO_LABELS}
        />

        <div>
          <h4 className="micro mb-2.5">Activity</h4>
          <ActivityFeed events={events} members={members} labels={DEMO_LABELS} />
        </div>
      </div>
    </div>
  );
}
