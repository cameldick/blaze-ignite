import { OverlayClient } from "./OverlayClient";

export const dynamic = "force-dynamic";

/**
 * OBS browser-source entrypoint: /overlay/<overlayToken>/<widget>
 * Transparent, no chrome — just the live widget driven by the bridge socket.
 */
export default function OverlayPage({
  params,
}: {
  params: { token: string; widget: string };
}) {
  return <OverlayClient token={params.token} widget={params.widget} />;
}
