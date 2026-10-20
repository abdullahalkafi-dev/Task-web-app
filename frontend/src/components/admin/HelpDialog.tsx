"use client";

import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";

export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="How Dayflow works" maxWidth="max-w-[520px]" footer={<Button onClick={onClose}>Got it</Button>}>
      <ul className="space-y-3 text-sm leading-relaxed text-ink-2">
        <li>
          <strong className="text-ink">Today’s tasks</strong> belong to one Dhaka day. At midnight (Asia/Dhaka) the board starts empty —
          unfinished tasks stay on their day and appear in History.
        </li>
        <li>
          <strong className="text-ink">Notes</strong> are permanent. Drag them in the sidebar to reorder.
        </li>
        <li>
          <strong className="text-ink">Offline</strong>: everything is saved on this device first and syncs automatically when you are back
          online. The pill at the top shows the state.
        </li>
        <li>
          <strong className="text-ink">History</strong>: pick a past day and use “Copy to Today” to bring a task forward.
        </li>
        <li>
          <strong className="text-ink">Sign in</strong> uses your Google account. There is no password to remember.
        </li>
      </ul>
    </Dialog>
  );
}
