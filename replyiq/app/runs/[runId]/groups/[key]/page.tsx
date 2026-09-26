import { notFound } from "next/navigation";
import ApprovalView from "@/components/approval/ApprovalView";
import { TAXONOMY } from "@/lib/taxonomy";
import type { Category } from "@/lib/types";
import { envStatus } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function GroupPage(props: PageProps<"/runs/[runId]/groups/[key]">) {
  const { runId, key } = await props.params;
  if (!(key in TAXONOMY)) notFound();
  return <ApprovalView runId={runId} groupKey={key as Category} launchEnabled={envStatus().launchEnabled} />;
}
