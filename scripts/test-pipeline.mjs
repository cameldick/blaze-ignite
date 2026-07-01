// End-to-end pipeline test: connect a fake overlay, fire a Test Event through the
// bridge control API, assert the overlay receives alert + goal + boss messages.
// Run: node --env-file=.env scripts/test-pipeline.mjs <channelId> <overlayToken>
import { io } from "socket.io-client";

const [channelId, overlayToken] = process.argv.slice(2);
const BRIDGE = "http://localhost:4000";
const received = [];

const socket = io(BRIDGE, { transports: ["websocket", "polling"], auth: { overlayToken } });

const done = (ok, msg) => {
  console.log(msg);
  console.log("RECEIVED:", JSON.stringify(received.map((m) => m.type)));
  socket.close();
  process.exit(ok ? 0 : 1);
};

socket.on("connect", async () => {
  console.log("overlay connected");
  socket.on("overlay", (m) => received.push(m));

  // Give the state snapshot a beat, then fire a Test Event.
  await new Promise((r) => setTimeout(r, 400));
  const res = await fetch(`${BRIDGE}/channels/${channelId}/test`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-internal-secret": process.env.BRIDGE_INTERNAL_SECRET },
    body: JSON.stringify({ amount: 120, actorName: "Alice", message: "let's go!" }),
  });
  console.log("test event POST:", res.status);

  await new Promise((r) => setTimeout(r, 1200));
  const types = new Set(received.map((m) => m.type));
  const hasAlert = types.has("alert");
  const hasGoal = received.some((m) => m.type === "goal" && m.current === 120);
  const hasBoss = received.some((m) => m.type === "boss" && m.hp === 380);
  if (hasAlert && hasGoal && hasBoss) done(true, "✅ PASS: alert + goal(120) + boss(hp 380) all received");
  else done(false, `❌ FAIL: alert=${hasAlert} goal=${hasGoal} boss=${hasBoss}`);
});

socket.on("connect_error", (e) => done(false, `connect_error: ${e.message}`));
setTimeout(() => done(false, "timeout"), 8000);
