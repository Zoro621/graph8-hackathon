import { Database, FileSearch, Inbox, Network, ScanSearch, ShieldCheck, Tags } from "lucide-react";
import type { StepName } from "@/lib/types";

const ICONS: Record<StepName, typeof Inbox> = {
  load: Database,
  fetch: Inbox,
  classify: ScanSearch,
  themes: Network,
  tag: Tags,
  resolve: ShieldCheck,
  cards: FileSearch,
};

export function AgentGlyph({ step, active, className = "size-5" }: { step: StepName; active?: boolean; className?: string }) {
  const Icon = ICONS[step];
  return <Icon className={`${className} transition-colors duration-300 ${active ? "text-iris" : "text-muted"}`} strokeWidth={1.6} />;
}
