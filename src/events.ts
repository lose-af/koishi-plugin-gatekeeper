import { Context } from "koishi";
import * as db from "./database";
import { Config } from "./config";

export function registerEventHandlers(ctx: Context) {
  ctx.on("guild-member-request", async (session) => {
    if (
      session.platform !== (ctx.config as Config).platform ||
      session.guildId !== (ctx.config as Config).genTicketIn
    )
      return;

    const records = await db.fetchUserRecords(
      ctx,
      (ctx.config as Config).identifier,
      `${session.platform}:${session.userId}`
    );

    if (records.length <= 0) {
      ctx.logger.info(
        `Rejecting user ${session.userId} joining guild ${
          (ctx.config as Config).useTicketIn
        } in platform ${session.platform} as they do not have records`
      );

      session.bot.handleGuildMemberRequest(
        session.messageId,
        false,
        (ctx.config as Config).message.noRecord
      );
      return;
    }

    // Sort by descending ID
    const someRecord = records.sort((a, b) => b.id - a.id)[0];
    const now = new Date();

    // Got denied
    if (!someRecord.accepted) {
      // In deny cooldown
      if (now.getTime() < someRecord.expire_at.getTime()) {
        ctx.logger.info(
          `Rejecting user ${session.userId} joining guild ${
            (ctx.config as Config).useTicketIn
          } in platform ${
            session.platform
          } as they are in the deny cooldown preiod`
        );

        session.bot.handleGuildMemberRequest(
          session.messageId,
          false,
          (ctx.config as Config).message.inDenyCooldown
        );
      } else {
        // After deny cooldown
        ctx.logger.info(
          `Rejecting user ${session.userId} joining guild ${
            (ctx.config as Config).useTicketIn
          } in platform ${session.platform} and invalidating their deny records`
        );

        session.bot.handleGuildMemberRequest(
          session.messageId,
          false,
          (ctx.config as Config).message.noRecord
        );

        // Invalidate expired records
        await db.updateUserRecords(
          ctx,
          records.map((record) => record.id),
          { invalidated: true }
        );
      }
      return;
    }

    // Accepted but expired ticket
    if (now.getTime() > someRecord.expire_at.getTime()) {
      ctx.logger.info(
        `Rejecting user ${session.userId} joining guild ${
          (ctx.config as Config).useTicketIn
        } in platform ${session.platform} as they provided expired ticket`
      );

      session.bot.handleGuildMemberRequest(
        session.messageId,
        false,
        (ctx.config as Config).message.expiredTicket
      );
      return;
    }

    // Accepted but incorrect ticket
    if (!session.content.includes(someRecord.ticket)) {
      ctx.logger.info(
        `Rejecting user ${session.userId} joining guild ${
          (ctx.config as Config).useTicketIn
        } in platform ${session.platform} as they provided incorrect ticket`
      );

      session.bot.handleGuildMemberRequest(
        session.messageId,
        false,
        (ctx.config as Config).message.invalidTicket
      );
      return;
    }

    // Finally the ticket is valid
    session.bot.handleGuildMemberRequest(session.messageId, true);
    ctx.logger.info(
      `Accepting user ${session.userId} joining guild ${
        (ctx.config as Config).useTicketIn
      } in platform ${session.platform}`
    );

    await db.updateUserRecords(
      ctx,
      records.map((record) => record.id),
      { invalidated: true }
    );

    // Remove from genTicket guild
    if ((ctx.config as Config).removeAfterAccepted) {
      ctx.logger.info(
        `Removing user ${session.userId} from guild ${
          (ctx.config as Config).genTicketIn
        } in platform ${session.platform} as they used the ticket in ${
          (ctx.config as Config).useTicketIn
        }`
      );

      await session.bot.kickGuildMember(
        (ctx.config as Config).genTicketIn,
        session.userId,
        false
      );
    }
  });
}
