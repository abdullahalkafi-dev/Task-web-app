import { Sun } from "lucide-react";
import { Button } from "../ui/Button";

export function EmptyDay({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="grid place-items-center rounded-panel bg-surface px-6 py-16 text-center shadow-sm2" data-testid="empty-day">
      <span className="mb-4 grid h-16 w-16 place-items-center rounded-[22px] bg-gradient-to-br from-orange-100 to-pink-100 text-orange-500">
        <Sun size={28} strokeWidth={1.5} />
      </span>
      <h3 className="text-lg font-semibold text-ink">A fresh day.</h3>
      <p className="mb-5 mt-1 text-sm text-ink-2">Nothing planned yet.</p>
      <Button plus onClick={onAdd}>
        Add Task
      </Button>
    </div>
  );
}
