import { notFound } from "next/navigation";
import ApprovalView from "@/components/approval/ApprovalView";
import { CATEGORY_KEYS } from "@/lib/taxonomy";
import type { Category } from "@/lib/types";

export default async function GroupPage(props: PageProps<"/runs/[runId]/groups/[key]">) {
  const { runId, key } = await props.params;
  if (!(CATEGORY_KEYS as string[]).includes(key)) notFound();
  return <ApprovalView runId={runId} groupKey={key as Category} />;
}
