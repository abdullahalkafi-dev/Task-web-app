"use client";

import { useState, type ReactNode } from "react";
import { CircleCheck, Circle, Clock, ListChecks, Loader, Moon, Sun } from "lucide-react";
import { IconRail } from "@/components/layout/IconRail";
import { TaskCard } from "@/components/tasks/TaskCard";
import { Button, IconButton } from "@/components/ui/Button";
import { Card, Panel } from "@/components/ui/Card";
import { ColumnHeader } from "@/components/ui/ColumnHeader";
import { Dialog } from "@/components/ui/Dialog";
import { Drawer } from "@/components/ui/Drawer";
import { GradientPill } from "@/components/ui/GradientPill";
import { InfoBanner } from "@/components/ui/InfoBanner";
import { PillTabs } from "@/components/ui/PillTabs";
import { ProfileCard } from "@/components/ui/ProfileCard";
import { StatTile } from "@/components/ui/StatTile";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { useTheme } from "@/hooks/useTheme";
import type { TaskDoc, TaskStatus } from "@/lib/types";

/** Hidden design-system page (not linked anywhere). Compare against /references/*.png */
const sample: TaskDoc = {
  id: "demo",
  userId: "u",
  taskDate: "2026-10-20",
  title: "Fix login bug",
  descriptionHtml: "<p>Resolve the 401 error when users sign in</p>",
  descriptionText: "Resolve the 401 error when users sign in with Google and the session cookie is missing.",
  estimatedMinutes: 90,
  status: "started",
  orderIndex: 1024,
  copiedFromDate: "2026-10-18",
  copiedFromTaskId: null,
  createdAt: "2026-10-20T00:00:00.000Z",
  updatedAt: "2026-10-20T00:00:00.000Z",
  deletedAt: null,
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">{title}</h2>
      {children}
    </section>
  );
}

export default function DevUiPage() {
  const toast = useToast();
  const { theme, toggle } = useTheme();
  const [tab, setTab] = useState("board");
  const [status, setStatus] = useState<TaskStatus>("notStarted");
  const [dialog, setDialog] = useState(false);
  const [drawer, setDrawer] = useState(false);

  return (
    <main id="main" className="min-h-dvh bg-canvas p-4 md:p-8">
      <meta name="robots" content="noindex" />
      <div className="shell-frame mx-auto max-w-6xl space-y-8 p-5 md:p-8">
        <header className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Dayflow UI kit</h1>
          <Button variant="secondary" size="sm" className="ml-auto" icon={theme === "dark" ? <Sun size={15} /> : <Moon size={15} />} onClick={toggle}>
            {theme === "dark" ? "Light" : "Dark"}
          </Button>
        </header>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button plus>Add Task</Button>
            <Button>Save</Button>
            <Button variant="secondary">Cancel</Button>
            <Button variant="soft">View Details</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="ai">Ask AI</Button>
            <Button variant="danger">Delete</Button>
            <IconButton label="Sun" active><Sun size={20} /></IconButton>
            <IconButton label="Moon"><Moon size={20} /></IconButton>
          </div>
        </Section>

        <Section title="Pill tabs · Status chips · Gradient pill">
          <div className="flex flex-wrap items-center gap-4">
            <PillTabs label="Demo" value={tab} onChange={setTab} options={[{ value: "board", label: "Board" }, { value: "list", label: "List" }]} />
            <StatusChip status="notStarted" />
            <StatusChip status="started" />
            <StatusChip status="completed" />
            <StatusChip status={status} onChange={setStatus} />
            <GradientPill><Clock size={13} /> Est: <strong className="text-ink">1h 30m</strong></GradientPill>
          </div>
        </Section>

        <Section title="Stat tiles">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile icon={<ListChecks size={20} />} value={6} label="Total tasks" />
            <StatTile icon={<Circle size={20} />} value={3} label="Not Started" tone="gray" />
            <StatTile icon={<Loader size={20} />} value={2} label="Started" tone="blue" />
            <StatTile icon={<CircleCheck size={20} />} value={1} label="Completed" tone="green" />
          </div>
        </Section>

        <Section title="Info banner">
          <InfoBanner title="Dayflow is offline-first." action={<Button size="sm" variant="soft">View Details</Button>}>
            Changes are saved on this device and sync automatically.
          </InfoBanner>
        </Section>

        <Section title="Column header + task card">
          <div className="grid gap-5 md:grid-cols-3">
            <div className="space-y-3 rounded-panel bg-surface-muted p-3">
              <ColumnHeader title="Not Started" count={3} accent="#F97316" />
              <div className="space-y-3">
                <TaskCard task={{ ...sample, status: "notStarted", copiedFromDate: null }} seq={1} onEdit={() => undefined} onDelete={() => undefined} onQuickAction={() => undefined} handleProps={{}} />
              </div>
            </div>
            <div className="space-y-3 rounded-panel bg-surface-muted p-3">
              <ColumnHeader title="Started" count={2} accent="#6366F1" />
              <div className="space-y-3">
                <TaskCard task={sample} seq={2} onEdit={() => undefined} onDelete={() => undefined} onQuickAction={() => undefined} handleProps={{}} />
              </div>
            </div>
            <div className="space-y-3 rounded-panel bg-surface-muted p-3">
              <ColumnHeader title="Completed" count={1} accent="#16A34A" />
              <div className="space-y-3">
                <TaskCard task={{ ...sample, status: "completed", copiedFromDate: null }} seq={3} onEdit={() => undefined} onDelete={() => undefined} onQuickAction={() => undefined} handleProps={{}} />
              </div>
            </div>
          </div>
        </Section>

        <Section title="Profile card · Icon rail · Card">
          <div className="flex flex-wrap items-start gap-8">
            <div className="w-[280px]">
              <ProfileCard name="Mike Cooper" subtitle="Member" />
            </div>
            <div className="flex h-[420px] items-stretch [&>nav]:flex">
              <IconRail isAdmin onHelp={() => undefined} onLogout={() => undefined} />
            </div>
            <Card className="w-56 p-5" interactive>Hover lift card</Card>
          </div>
        </Section>

        <Section title="Dialog · Drawer · Toast">
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setDialog(true)}>Open dialog</Button>
            <Button variant="secondary" onClick={() => setDrawer(true)}>Open drawer</Button>
            <Button variant="secondary" onClick={() => toast.show("Copied to today ✓")}>Show toast</Button>
          </div>
        </Section>
      </div>

      <Dialog open={dialog} onClose={() => setDialog(false)} title="Sample dialog" footer={<Button onClick={() => setDialog(false)}>Save</Button>}>
        <p className="text-sm text-ink-2">Centered on desktop, full-screen bottom sheet on mobile.</p>
      </Dialog>
      <Drawer open={drawer} onClose={() => setDrawer(false)} label="Sample drawer">
        <Panel className="h-full p-5">Drawer content</Panel>
      </Drawer>
    </main>
  );
}
