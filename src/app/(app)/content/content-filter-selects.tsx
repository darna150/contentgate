"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const SELECT_CLASS =
  "w-full min-w-0 rounded-control border border-edge-strong bg-surface px-3 py-2 text-[12.5px] text-ink transition-colors outline-none focus:border-brand sm:w-auto";

export function ContentFilterSelects({
  activeLanguage,
  activeSize,
  languages,
  sizeOptions,
}: {
  activeLanguage: string;
  activeSize: string;
  languages: string[];
  sizeOptions: { value: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(key: "language" | "size", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete(key);
    else params.set(key, value);
    params.delete("cursor");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <label className="w-full min-w-0 sm:w-auto">
        <span className="sr-only">Filter by language</span>
        <select
          value={activeLanguage}
          onChange={(event) => update("language", event.target.value)}
          className={SELECT_CLASS}
        >
          <option value="all">All languages</option>
          {languages.map((language) => (
            <option key={language} value={language}>
              {language}
            </option>
          ))}
        </select>
      </label>

      {sizeOptions.length > 0 && (
        <label className="w-full min-w-0 sm:w-auto">
          <span className="sr-only">Filter by size</span>
          <select
            value={activeSize}
            onChange={(event) => update("size", event.target.value)}
            className={SELECT_CLASS}
          >
            <option value="all">All sizes</option>
            {sizeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
