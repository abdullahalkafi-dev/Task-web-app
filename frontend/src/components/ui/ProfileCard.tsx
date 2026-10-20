import type { ReactNode } from "react";
import { Avatar } from "./Avatar";

/** Reference: "Mike Cooper" card — gradient header, overlapping avatar, white inner card, glowing bottom edge. */
export function ProfileCard({ name, subtitle, footer }: { name: string; subtitle: string; footer?: ReactNode }) {
  return (
    <div className="relative rounded-[28px] bg-surface p-2.5 shadow-lg2">
      <div className="relative h-24 overflow-hidden rounded-[20px] bg-grad-profile">
        <div className="absolute inset-0 bg-gradient-to-tr from-white/70 via-transparent to-transparent" />
        <div className="absolute left-4 top-4">
          <Avatar name={name} size={44} ring />
        </div>
      </div>
      <div className="relative -mt-6 rounded-[18px] border-b-[3px] border-transparent bg-surface px-5 pb-5 pt-5 shadow-md2 [background:linear-gradient(var(--surface),var(--surface))_padding-box,linear-gradient(90deg,#60a5fa,#a78bfa,#f472b6)_border-box]">
        <p className="truncate text-[15px] font-semibold text-ink">{name}</p>
        <p className="mt-0.5 truncate text-xs text-ink-2">{subtitle}</p>
        {footer && <div className="mt-2">{footer}</div>}
      </div>
    </div>
  );
}
