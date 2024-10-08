import { Context } from "koishi";
import * as db from "./database";
import { Config } from "./config";

export function registerEventHandlers(ctx: Context) {
  ctx.on("guild-member-request", async (session) => {
    if (
      session.platform !== (ctx.config as Config).platform ||
      session.guildId !== (ctx.config as Config).useTicketIn
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
    ctx.logger.info(
      `Accepting user ${session.userId} joining guild ${
        (ctx.config as Config).useTicketIn
      } in platform ${session.platform}`
    );
    session.bot
      .handleGuildMemberRequest(session.messageId, true)
      .then(() => {
        db.updateUserRecords(
          ctx,
          records.map((record) => record.id),
          { invalidated: true }
        );
      })
      .then(async () => {
        // Remove from genTicket guild
        const member = await session.bot.getGuildMember(
          (ctx.config as Config).useTicketIn,
          session.userId
        );

        // Ensure the user is actually joined the guild
        if (member && member.user.id === session.userId) {
          if ((ctx.config as Config).removeAfterAccepted) {
            ctx.logger.info(
              `Trying to kick user ${session.userId} from guild ${
                (ctx.config as Config).genTicketIn
              } in platform ${session.platform} as they joined guild ${
                (ctx.config as Config).useTicketIn
              }`
            );

            session.bot.kickGuildMember(
              (ctx.config as Config).genTicketIn,
              session.userId,
              false
            );
          }
        } else {
          ctx.logger.warn(
            `User ${session.userId} from guild ${
              (ctx.config as Config).genTicketIn
            } in platform ${session.platform} failed to join guild ${
              (ctx.config as Config).useTicketIn
            }, sending notifications.`
          );

          // Warn moderators about the failure (member have not joined successfully).
          await session.bot.sendMessage(
            (ctx.config as Config).genTicketIn,
            (ctx.config as Config).message.joinFailed.replaceAll(
              "{user}",
              session.userId
            )
          );
        }
      })
      .catch(async (error) => {
        if (error instanceof Error) {
          await session.bot.sendMessage(
            (ctx.config as Config).genTicketIn,
            "Error: " + error.message
          );
          return;
        }
        throw error;
      });
  });
}
