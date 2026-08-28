export function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
        <circle cx="9" cy="9" r="7.25" stroke="var(--color-accent)" strokeWidth="1.5" />
        <circle cx="9" cy="1.75" r="1.75" fill="var(--color-accent)" />
      </svg>
      <span className="font-serif text-[19px] leading-none text-ink">Savora</span>
    </span>
  );
}
