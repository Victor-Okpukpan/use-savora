import {
  getBase58Decoder,
  getBase64Encoder,
  type Address,
} from "@solana/kit";

import {
  GROUP_DISCRIMINATOR,
  decodeGroup,
  fetchMaybeCycle,
  fetchMaybeGroup,
  getGroupDecoder,
  type Cycle,
  type Group,
} from "@/generated";

import { PROGRAM_ID } from "./config";
import { findCyclePda } from "./pdas";
import { rpc as defaultRpc, type Rpc } from "./rpc";

export type GroupAccount = { address: Address; data: Group };
export type CycleAccount = { address: Address; data: Cycle };

export async function getGroup(
  address: Address,
  rpc: Rpc = defaultRpc,
): Promise<GroupAccount | null> {
  const acc = await fetchMaybeGroup(rpc, address);
  return acc.exists ? { address, data: acc.data } : null;
}

export async function getCycle(
  group: Address,
  index: number,
  rpc: Rpc = defaultRpc,
): Promise<CycleAccount | null> {
  const [cycle] = await findCyclePda(group, index);
  const acc = await fetchMaybeCycle(rpc, cycle);
  return acc.exists ? { address: cycle, data: acc.data } : null;
}

/** Current cycle plus every settled one, newest first. */
export async function getCycleHistory(
  group: GroupAccount,
  rpc: Rpc = defaultRpc,
): Promise<CycleAccount[]> {
  const count = group.data.currentCycle + 1;
  const indices = Array.from({ length: count }, (_, i) => i).filter(
    (i) => i < group.data.memberCount,
  );
  const cycles = await Promise.all(
    indices.map((i) => getCycle(group.address, i, rpc)),
  );
  return cycles.filter((c): c is CycleAccount => c !== null).reverse();
}

/**
 * Every group whose roster includes `member`.
 *
 * A `getProgramAccounts` discriminator scan, filtered client-side on the
 * members array. Fine at devnet scale; swap for an index if this ever needs
 * to serve real traffic.
 */
export async function getGroupsForMember(
  member: Address,
  rpc: Rpc = defaultRpc,
): Promise<GroupAccount[]> {
  const discriminatorBase58 = getBase58Decoder().decode(GROUP_DISCRIMINATOR);
  const response = await rpc
    .getProgramAccounts(PROGRAM_ID, {
      encoding: "base64",
      filters: [
        {
          memcmp: {
            offset: 0n,
            bytes: discriminatorBase58 as never,
            encoding: "base58",
          },
        },
      ],
    })
    .send();

  const accounts = (
    Array.isArray(response) ? response : (response as { value: unknown[] }).value
  ) as unknown[];

  const base64 = getBase64Encoder();
  const out: GroupAccount[] = [];
  for (const raw of accounts) {
    const entry = raw as {
      pubkey: Address;
      account: { data: [string, string] };
    };
    const bytes = base64.encode(entry.account.data[0]);
    const data = getGroupDecoder().decode(bytes);
    if (data.members.slice(0, data.memberCount).includes(member)) {
      out.push({ address: entry.pubkey, data });
    }
  }
  return out;
}

export { decodeGroup };
