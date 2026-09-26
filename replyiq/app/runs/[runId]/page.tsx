import RunView from "@/components/run/RunView";

export default async function RunPage(props: PageProps<"/runs/[runId]">) {
  const { runId } = await props.params;
  return <RunView runId={runId} />;
}
