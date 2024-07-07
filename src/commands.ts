import { Context } from "koishi";
import * as db from "./database";
import { Config } from "./config";
import { createId } from "@paralleldrive/cuid2";

export function registerCommands(ctx: Context) {
  ctx
    .command("gatekeeper.accept <user:user>", {
      permissions: ["gatekeeper.accept"],
    })
    .action(async ({ session }, userId) => {
      if (
        session.platform !== (ctx.config as Config).platform ||
        session.guildId !== (ctx.config as Config).genTicketIn
      )
        return;

      await db.invalidateOldRecords(ctx, userId);

      const ticket = createId().slice(0, 8);
      const now = new Date();
      const expire = new Date();
      expire.setSeconds(
        now.getSeconds() + (ctx.config as Config).validForSeconds
      );

      await db.insertNewRecord(ctx, {
        id: null,
        created_at: now,
        expire_at: expire,
        user_id: userId,
        ticket: ticket,
        accepted: true,
        invalidated: false,
      });

      const text = (ctx.config as Config).message.userAccepted.replaceAll(
        "{ticket}",
        ticket
      );
      session.send(text);
    });

  ctx
    .command("gatekeeper.deny <user:user>", {
      permissions: ["gatekeeper.deny"],
    })
    .action(async ({ session }, userId) => {
      if (
        session.platform !== (ctx.config as Config).platform ||
        session.guildId !== (ctx.config as Config).genTicketIn
      )
        return;

      await db.invalidateOldRecords(ctx, userId);

      const now = new Date();
      const afterCooldown = new Date();
      afterCooldown.setSeconds(
        now.getSeconds() + (ctx.config as Config).denyCooldownSeconds
      );

      await db.insertNewRecord(ctx, {
        id: null,
        created_at: now,
        expire_at: afterCooldown,
        user_id: userId,
        ticket: null,
        accepted: false,
        invalidated: false,
      });

      session.send((ctx.config as Config).message.userDenied);
    });
}
