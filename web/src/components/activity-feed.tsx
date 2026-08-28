import { explorerUrl } from "@/lib/savora/config";
import { formatUsdc, shortAddress } from "@/lib/savora/format";
import type { ActivityEvent } from "@/lib/savora/activity";
import { MemberMark } from "./member-identity";

const KIND_LABEL: Record<ActivityEvent["kind"], string> = {
  formed: "Created",
  sealed: "Sealed",
  paid: "Payout",
  closed: "Closed",
  open: "Open",
  missed: "Missed",
  completed: "Done",
};

/** An event may carry its own roster + circle name (merged multi-circle feed). */
type FeedEvent = ActivityEvent & {
  members?: string[];
  circle?: string;
};

export function ActivityFeed({
  events,
  members,
  labels,
}: {
  events: FeedEvent[];
  members?: string[];
  labels?: (string | undefined)[];
}) {
  if (events.length === 0) {
    return (
      <p className="text-[13px] text-ink-muted">
        Nothing has happened here yet.
      </p>
    );
  }

  return (
    <ol className="overflow-hidden rounded-card border border-line">
      {events.map((e) => {
        const roster = e.members ?? members ?? [];
        const addr =
          e.memberIndex != null ? roster[e.memberIndex] : undefined;
        const who =
          e.memberIndex != null
            ? (labels?.[e.memberIndex] ?? shortAddress(addr ?? "", 4, 4))
            : null;

        return (
          <li
            key={e.key}
            className="flex items-center gap-3 border-b border-line px-4 py-3 text-[13px] last:border-0"
          >
            <span className="micro w-14 shrink-0">{KIND_LABEL[e.kind]}</span>
            {addr ? <MemberMark address={addr} size={16} /> : null}
            <span className="min-w-0 flex-1 truncate text-ink-muted">
              {e.circle ? (
                <span className="mr-1.5 text-ink">{e.circle}</span>
              ) : null}
              {e.kind === "paid" && who ? (
                <>
                  <span className="text-ink">{who}</span> collected{" "}
                  <span className="tnum text-ink">
                    {formatUsdc(e.amount ?? 0n, { fixed: true })} USDC
                  </span>
                </>
              ) : (
                e.text
              )}
            </span>
            {e.ref ? (
              <a
                href={explorerUrl(e.ref)}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-[12px] text-ink-faint transition-colors hover:text-accent"
                title="View on Solana Explorer"
              >
                ↗
              </a>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
