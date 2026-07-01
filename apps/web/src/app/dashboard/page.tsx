import { prisma } from "@blaze-ignite/db";
import { getSessionChannelId } from "@/lib/session";
import { env } from "@/lib/env";
import { DashboardApp } from "./DashboardApp";

export const dynamic = "force-dynamic";

function Banner({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <div className="mb-6 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      <strong>Connection failed.</strong> {error}
    </div>
  );
}

/** Connected → full editor app. Not connected → Blaze OAuth connect button. */
export default async function Dashboard({
  searchParams,
}: {
  searchParams: { error?: string; connected?: string };
}) {
  const error = searchParams.error;
  const channelId = getSessionChannelId();
  const channel = channelId
    ? await prisma.channel.findUnique({ where: { id: channelId } }).catch(() => null)
    : null;

  if (!channel) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Banner error={error} />
        <h1 className="text-3xl font-black">Creator dashboard</h1>
        <p className="mt-3 text-zinc-400">
          Connect your Blaze channel to turn Thanks and Backstage votes into live
          overlay actions.
        </p>
        <a
          href="/api/auth/blaze/start"
          className="mt-6 inline-block rounded-lg bg-ignite px-5 py-2.5 font-semibold text-black transition hover:brightness-110"
        >
          {error ? "Try connecting again" : "Connect Blaze channel"}
        </a>
      </main>
    );
  }

  return (
    <div>
      <div className="mx-auto max-w-4xl px-6 pt-6">
        <Banner error={error} />
      </div>
      <DashboardApp
        channelName={channel.displayName}
        overlayBase={`${env.appUrl}/overlay/${channel.overlayToken}`}
      />
    </div>
  );
}
