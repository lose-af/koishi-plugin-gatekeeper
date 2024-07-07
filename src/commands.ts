import { Context } from "koishi";
import * as db from "./database";
import { Config } from "./config";
import { createId } from "@paralleldrive/cuid2";

export function registerCommands(ctx: Context) {
  ctx
    .command(
      `gatekeeper_${(ctx.config as Config).identifier}.accept <user:user>`,
      {
        permissions: [`gatekeeper.${(ctx.config as Config).identifier}.accept`],
      }
    )
    .action(async ({ session }, userId) => {
      if (
        session.platform !== (ctx.config as Config).platform ||
        session.guildId !== (ctx.config as Config).genTicketIn
      )
        return;

      await db.invalidateOldRecords(
        ctx,
        (ctx.config as Config).identifier,
        userId
      );

      const ticket = createId().slice(0, 8);

      await db.insertNewRecord(ctx, (ctx.config as Config).identifier, {
        user_id: userId,
        ticket: ticket,
        accepted: true,
      });

      const text = (ctx.config as Config).message.userAccepted.replaceAll(
        "{ticket}",
        ticket
      );
      session.send(text);
    });

  ctx
    .command(
      `gatekeeper_${(ctx.config as Config).identifier}.deny <user:user>`,
      {
        permissions: [`gatekeeper.${(ctx.config as Config).identifier}.deny`],
      }
    )
    .action(async ({ session }, userId) => {
      if (
        session.platform !== (ctx.config as Config).platform ||
        session.guildId !== (ctx.config as Config).genTicketIn
      )
        return;

      await db.invalidateOldRecords(
        ctx,
        (ctx.config as Config).identifier,
        userId
      );

      await db.insertNewRecord(ctx, (ctx.config as Config).identifier, {
        user_id: userId,
        ticket: null,
        accepted: false,
      });

      session.send((ctx.config as Config).message.userDenied);
    });
}
