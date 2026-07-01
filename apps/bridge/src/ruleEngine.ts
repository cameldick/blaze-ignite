import {
  type ActionRule,
  type OverlayMessage,
  type ThanksEvent,
  type FollowEvent,
  type SubscriptionEvent,
  type GiftEvent,
  DEFAULT_THEME,
} from "@blaze-ignite/shared";
import { addToGoal, addToWarOption, damageBoss, resolveWarOptionId } from "./store.js";
import { log } from "./log.js";

/** Substitute {name}/{amount} in a custom alert message. */
function renderText(tpl: string | undefined, name: string, amount?: number): string | undefined {
  if (!tpl) return undefined;
  return tpl
    .replace(/\{name\}/g, name)
    .replace(/\{amount\}/g, amount != null ? String(amount) : "");
}

/** Does this thanks satisfy a rule's match conditions? */
function matches(rule: ActionRule, thanks: ThanksEvent): boolean {
  const m = rule.match;
  if (m.minAmount !== undefined && thanks.amount < m.minAmount) return false;
  if (m.maxAmount !== undefined && thanks.amount > m.maxAmount) return false;
  return true;
}

/**
 * Apply every matching rule to a `channel.thanks` (rules compose — an alert AND
 * a goal can both fire). Performs the state mutations and returns the overlay
 * messages to broadcast for this channel.
 */
export async function applyThanks(
  thanks: ThanksEvent,
  rules: ActionRule[],
  preview = false,
): Promise<OverlayMessage[]> {
  const amount = thanks.amount;
  const out: OverlayMessage[] = [];

  for (const rule of rules) {
    if (!matches(rule, thanks)) continue;
    const action = rule.action;
    // Preview (dashboard test): show alerts only, never mutate goal/boss/war state.
    if (preview && action.type !== "alert") continue;
    try {
      switch (action.type) {
        case "alert":
          if (!action.on.includes("thanks")) break; // this alert isn't for Thanks
          out.push({
            type: "alert",
            eventKind: "thanks",
            headline: renderText(action.text, thanks.actor.displayName ?? thanks.actor.username, amount),
            actorName: thanks.actor.displayName ?? thanks.actor.username,
            actorAvatar: thanks.actor.avatarUrl,
            amount,
            message: thanks.message,
            theme: action.theme ?? DEFAULT_THEME,
            animation: action.animation,
            durationSec: action.durationSec,
            fontSize: action.fontSize,
            sound: action.sound,
            volume: action.volume,
          });
          break;
        case "goal": {
          const state = await addToGoal(action.goalId, amount);
          if (state) out.push({ ...state, lastContributor: thanks.actor.username });
          break;
        }
        case "tipwar": {
          const optionId = await resolveWarOptionId(action.warId, action.optionId, thanks.message);
          if (optionId) {
            const state = await addToWarOption(optionId, amount);
            if (state) out.push(state);
          }
          break;
        }
        case "boss": {
          const damage = amount * action.damagePerPoint;
          const state = await damageBoss(
            action.bossId,
            damage,
            thanks.actor.displayName ?? thanks.actor.username,
          );
          if (state) out.push(state);
          break;
        }
      }
    } catch (err) {
      log.error("rule action failed", { ruleId: rule.id, type: action.type, err: String(err) });
    }
  }
  return out;
}

/**
 * Fire alert overlays for a follow or subscription. Only alert rules whose `on`
 * list includes the event kind react; no state is mutated.
 */
export function applyEventAlerts(
  event: FollowEvent | SubscriptionEvent | GiftEvent,
  rules: ActionRule[],
): OverlayMessage[] {
  const out: OverlayMessage[] = [];
  const amount = "amount" in event ? event.amount : undefined; // gift → giftCount
  for (const rule of rules) {
    const action = rule.action;
    if (action.type !== "alert") continue;
    if (!action.on.includes(event.kind)) continue;
    const name = event.actor.displayName ?? event.actor.username;
    out.push({
      type: "alert",
      eventKind: event.kind,
      headline: renderText(action.text, name, amount),
      actorName: name,
      amount: event.kind === "gift" ? amount : undefined,
      actorAvatar: event.actor.avatarUrl,
      theme: action.theme ?? DEFAULT_THEME,
      animation: action.animation,
      durationSec: action.durationSec,
      fontSize: action.fontSize,
      sound: action.sound,
      volume: action.volume,
    });
  }
  return out;
}
