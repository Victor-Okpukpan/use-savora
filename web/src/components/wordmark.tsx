import { SavoraMark } from "@/lib/brand";

export function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <SavoraMark size={18} color="var(--color-accent)" />
      <span className="font-serif text-[19px] leading-none text-ink">Savora</span>
    </span>
  );
}
