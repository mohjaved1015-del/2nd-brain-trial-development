import { ChatPanel } from "@/components/ChatPanel";

// TODO: replace with the signed-in user's actual org_id once Supabase Auth is wired in.
const PLACEHOLDER_ORG_ID = "00000000-0000-0000-0000-000000000000";

export default function Home() {
  return (
    <main>
      <h1>Second Brain</h1>
      <ChatPanel orgId={PLACEHOLDER_ORG_ID} />
    </main>
  );
}
