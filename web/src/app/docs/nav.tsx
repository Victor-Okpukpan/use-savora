"use client";

import { useEffect, useState } from "react";

type Section = {
  heading: string;
  id: string;
  items: [string, string][];
};

export function DocNav({ sections }: { sections: Section[] }) {
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const ids = sections.flatMap((s) => s.items.map(([id]) => id));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav className="sticky top-24 hidden h-fit w-52 shrink-0 flex-col gap-6 lg:flex">
      {sections.map((s) => (
        <div key={s.id}>
          <p className="micro">{s.heading}</p>
          <ul className="mt-3 flex flex-col gap-2 border-l border-line">
            {s.items.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className={`-ml-px block border-l pl-3 text-[13px] transition-colors ${
                    active === id
                      ? "border-accent text-ink"
                      : "border-transparent text-ink-muted hover:text-ink"
                  }`}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
