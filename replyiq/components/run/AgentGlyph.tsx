import { Database, FileSearch, Inbox, ScanSearch, ShieldCheck, Tags } from "lucide-react";
import type { StepKey } from "@/lib/types";

const ICONS: Record<StepKey, typeof Inbox> = {
  load: Database,
  fetch: Inbox,
  classify: ScanSearch,
  tag: Tags,
  resolve: ShieldCheck,
  cards: FileSearch,
};

export function AgentGlyph({ step, active, className = "size-5" }: { step: StepKey; active?: boolean; className?: string }) {
  const Icon = ICONS[step];
  return <Icon className={`${className} transition-colors duration-300 ${active ? "text-iris" : "text-muted"}`} strokeWidth={1.6} />;
}
