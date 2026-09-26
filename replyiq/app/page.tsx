import { envStatus } from "@/lib/env";
import CommandCenter from "@/components/home/CommandCenter";

export const dynamic = "force-dynamic";

export default function Home() {
  return <CommandCenter env={envStatus()} />;
}
