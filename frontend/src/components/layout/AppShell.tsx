"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CircleHelp, KeyRound, LogOut, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { useTheme } from "@/hooks/useTheme";
import { displayName } from "@/lib/types";
import { HelpDialog } from "../admin/HelpDialog";
import { NotesSidebar } from "../notes/NotesSidebar";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Drawer } from "../ui/Drawer";
import { InfoBanner } from "../ui/InfoBanner";
import { PillTabs } from "../ui/PillTabs";
import { ProfileCard } from "../ui/ProfileCard";
import { BottomTabBar, type MobileTab } from "./BottomTabBar";
import { IconRail } from "./IconRail";
import { TopBar } from "./TopBar";

interface ShellValue {
  /** Increments each time something outside Home (e.g. the mobile "+") asks for the task editor. */
  addTaskTick: number;
  requestAddTask: () => void;
}

const ShellContext = createContext<ShellValue | null>(null);

export function useShell(): ShellValue {
  const v = useContext(ShellContext);
  if (!v) throw new Error("useShell must be used inside <AppShell>");
  return v;
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { user, logout, expired } = useAuth();
  const { unauthorized } = useSyncStatus();
  const { theme, set: setTheme } = useTheme();
  const activeNote = params.get("note");

  const [drawer, setDrawer] = useState(false);
  const [notesSheet, setNotesSheet] = useState(false);
  const [meSheet, setMeSheet] = useState(false);
  const [help, setHelp] = useState(false);
  const [tick, setTick] = useState(0);

  const isAdmin = user?.role === "superadmin";

  const requestAddTask = useCallback(() => {
    if (pathname !== "/" || activeNote) router.push("/");
    setTick((t) => t + 1);
  }, [pathname, activeNote, router]);

  const selectNote = useCallback(
    (id: string) => {
      setDrawer(false);
      setNotesSheet(false);
      router.push(`/?note=${id}`);
    },
    [router],
  );

  const ctx = useMemo<ShellValue>(
    () => ({ addTaskTick: tick, requestAddTask }),
    [tick, requestAddTask],
  );

  const mobileTab: MobileTab = meSheet || pathname.startsWith("/users") ? "me" : notesSheet ? "notes" : pathname.startsWith("/history") ? "history" : "today";

  return (
    <ShellContext.Provider value={ctx}>
      <div className="min-h-dvh bg-shell">
        <div className="flex min-h-dvh gap-4 p-3 md:h-dvh md:min-h-0 md:overflow-hidden md:p-4 lg:gap-5">
          <IconRail isAdmin={isAdmin} onHelp={() => setHelp(true)} onLogout={() => void logout()} />

          <aside className="hidden w-[260px] shrink-0 lg:block xl:w-[300px]" aria-label="Notes">
            <NotesSidebar activeId={activeNote} onSelect={selectNote} showHeader />
          </aside>

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {/* From lg up the sync pill / date / avatar live at the top of the notes sidebar instead. */}
            <div className="max-md:sticky max-md:top-0 max-md:z-30 max-md:-mx-3 max-md:-mt-3 max-md:bg-shell max-md:px-3 max-md:pt-3 lg:hidden">
              <TopBar onOpenNotes={() => setDrawer(true)} />
            </div>

            {(expired || unauthorized) && (
              <InfoBanner
                title="Your session expired."
                icon={<KeyRound size={18} strokeWidth={1.75} />}
                action={
                  <Button
                    size="sm"
                    variant="soft"
                    onClick={() => router.push("/login")}
                  >
                    Sign in again
                  </Button>
                }
              >
                Your changes are safe on this device and will sync once you sign in.
              </InfoBanner>
            )}

            <main id="main" className="scroll-hidden min-h-0 flex-1 pb-28 md:overflow-y-auto md:pb-2">
              {children}
            </main>
          </div>
        </div>
      </div>

      <BottomTabBar
        active={mobileTab}
        onAdd={requestAddTask}
        onSelect={(t) => {
          setNotesSheet(false);
          setMeSheet(false);
          if (t === "today") router.push("/");
          if (t === "history") router.push("/history");
          if (t === "notes") setNotesSheet(true);
          if (t === "me") setMeSheet(true);
        }}
      />

      {/* tablet: notes drawer */}
      <Drawer open={drawer} onClose={() => setDrawer(false)} label="Notes">
        <NotesSidebar activeId={activeNote} onSelect={selectNote} />
      </Drawer>

      {/* mobile: notes as a full-screen sheet */}
      <Dialog open={notesSheet} onClose={() => setNotesSheet(false)} title="Notes" maxWidth="max-w-none">
        <div className="h-[calc(100dvh-8rem)]">
          <NotesSidebar activeId={activeNote} onSelect={selectNote} />
        </div>
      </Dialog>

      {/* mobile: "Me" sheet */}
      <Dialog open={meSheet} onClose={() => setMeSheet(false)} title="Me" maxWidth="max-w-none">
        <div className="space-y-4 pb-4">
          <ProfileCard name={displayName(user)} subtitle={user?.role === "superadmin" ? "Super Admin" : (user?.email ?? "Member")} />
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-ink-2">Theme</p>
            <PillTabs
              label="Theme"
              value={theme}
              onChange={setTheme}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
          </div>
          <div className="grid gap-2">
            {isAdmin && (
              <Button variant="soft" icon={<Users size={18} />} onClick={() => { setMeSheet(false); router.push("/users"); }}>
                User management
              </Button>
            )}
            <Button variant="soft" icon={<CircleHelp size={18} />} onClick={() => { setMeSheet(false); setHelp(true); }}>
              Help
            </Button>
            <Button variant="secondary" icon={<LogOut size={18} />} onClick={() => void logout()}>
              Log out
            </Button>
          </div>
        </div>
      </Dialog>

      <HelpDialog open={help} onClose={() => setHelp(false)} />
    </ShellContext.Provider>
  );
}
