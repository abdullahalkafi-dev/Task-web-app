"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { TeamMember } from "@dayflow/shared";
import { Avatar } from "../ui/Avatar";
import { inputClass } from "../ui/Field";
export function AssigneePicker({
  members,
  value,
  onChange,
  disabled,
}: {
  members: TeamMember[];
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const options = [
    { id: "", name: "Unassigned", email: "" },
    ...members,
  ].filter((p) =>
    `${p.name} ${p.email}`.toLowerCase().includes(query.toLowerCase()),
  );
  const chosen = members.find((m) => m.id === value);
  useEffect(() => {
    if (open)
      document
        .getElementById(`${id}-option-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, open, id]);
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const select = (next: string) => {
    onChange(next || null);
    setOpen(false);
    setQuery("");
    button.current?.focus();
  };
  return (
    <div ref={root} className="relative space-y-1.5">
      <label
        id={`${id}-label`}
        className="block text-[13px] font-medium text-ink-2"
      >
        Assigned to
      </label>
      <button
        ref={button}
        type="button"
        disabled={disabled}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`${inputClass} flex items-center gap-2 text-left disabled:opacity-50`}
        onClick={() => {
          setOpen(!open);
          setActive(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {chosen && <Avatar name={chosen.name} size={24} />}
        <span id={`${id}-value`} className="min-w-0 flex-1 truncate">
          {chosen?.name ?? "Unassigned"}
        </span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-[75] rounded-2xl border border-line bg-surface p-2 shadow-lg2">
          <input
            ref={input}
            role="combobox"
            aria-label="Search team members"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-controls={`${id}-list`}
            aria-activedescendant={
              options[active] ? `${id}-option-${active}` : undefined
            }
            className={inputClass}
            placeholder="Search members…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                event.preventDefault();
                setActive((index) =>
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? options.length - 1
                      : (index +
                          (event.key === "ArrowDown" ? 1 : -1) +
                          options.length) %
                        Math.max(1, options.length),
                );
              }
              if (event.key === "Enter" && options[active]) {
                event.preventDefault();
                select(options[active].id);
              }
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
                button.current?.focus();
              }
              if (event.key === "Tab") setOpen(false);
            }}
          />
          <ul
            id={`${id}-list`}
            role="listbox"
            aria-labelledby={`${id}-label`}
            className="mt-1 max-h-52 overflow-y-auto"
          >
            {options.map((person, index) => (
              <li
                key={person.id}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={(value ?? "") === person.id}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm ${index === active ? "bg-surface-muted" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => select(person.id)}
              >
                {person.id && <Avatar name={person.name} size={24} />}
                <span className="min-w-0 flex-1 truncate">{person.name}</span>
                {(value ?? "") === person.id && <Check size={15} />}
              </li>
            ))}
          </ul>
          {!options.length && (
            <p className="p-3 text-sm text-ink-2">No members match.</p>
          )}
        </div>
      )}
    </div>
  );
}
