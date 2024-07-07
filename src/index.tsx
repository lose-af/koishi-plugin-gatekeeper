import { Context, Schema } from "koishi";
import { createId } from "@paralleldrive/cuid2";

export const name = "gatekeeper";
export const inject = ["database"];

export interface Config {
  platform: string;
  genTicketIn: string;
  useTicketIn: string;
  validForSeconds: number;
  denyCooldownSeconds: number;
  removeAfterAccepted: boolean;
  message: {
    userAccepted: string;
    userDenied: string;
    inDenyCooldown: string;
    noRecord: string;
    invalidTicket: string;
    expiredTicket: string;
  };
}

export const Config: Schema<Config> = Schema.object({
  platform: Schema.string().required(true).default("onebot"),
  genTicketIn: Schema.string().required(true),
  useTicketIn: Schema.string().required(true),
  validForSeconds: Schema.number().required(true).default(172800),
  denyCooldownSeconds: Schema.number().required(true).default(1314000),
  removeAfterAccepted: Schema.boolean().required(true).default(false),
  message: Schema.object({
    userAccepted: Schema.string()
      .required(true)
      .default("您的申请已通过, Ticket: {ticket}"),
    userDenied: Schema.string().required(true).default("您没有通过审核。"),
    inDenyCooldown: Schema.string()
      .required(true)
      .default("请待一年冷静期后再次审核。"),
    noRecord: Schema.string()
      .required(true)
      .default("进入社区前请先加入审核群。"),
    invalidTicket: Schema.string()
      .required(true)
      .default("请正确输入入群凭证。"),
    expiredTicket: Schema.string()
      .required(true)
      .default("请联系审核群管理员再次发放凭证。"),
  }),
});

const DATABASE_TABLE = "gatekeeper";

declare module "koishi" {
  interface Tables {
    [DATABASE_TABLE]: GatekeeperModel;
  }
}

export interface GatekeeperModel {
  id: number;
  created_at: Date;
  expire_at: Date;
  user_id: string;
  ticket: string;
  accepted: boolean;
  invalidated: boolean;
}

export function apply(ctx: Context) {
  ctx.permissions.define("gatekeeper.accept", {});
  ctx.permissions.define("gatekeeper.deny", {});

  ctx.model.extend(DATABASE_TABLE, {
    id: { type: "unsigned", nullable: false },
    created_at: { type: "timestamp", nullable: false },
    expire_at: { type: "timestamp", nullable: true },
    user_id: { type: "string", nullable: false },
    ticket: { type: "string", nullable: true },
    accepted: { type: "boolean", nullable: false },
    invalidated: { type: "boolean", nullable: false },
  });

  // Accept user
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

      // Invalidate old data.
      const records = await ctx.database.get(DATABASE_TABLE, {
        user_id: userId,
        invalidated: false,
      });

      await ctx.database.set(
        DATABASE_TABLE,
        records.map((record) => record.id),
        {
          invalidated: true,
        }
      );

      // Generate ticket and insert to database
      // QQ limits this to 15 characters so we make it shorter here
      const ticket = createId().slice(0, 8);
      const now = new Date();
      const expire = new Date();
      expire.setSeconds(
        expire.getSeconds() + (ctx.config as Config).validForSeconds
      );

      ctx.database.create(DATABASE_TABLE, {
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

  // Deny user
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

      // Invalidate old data.
      const records = await ctx.database.get(DATABASE_TABLE, {
        user_id: userId,
        invalidated: false,
      });

      await ctx.database.set(
        DATABASE_TABLE,
        records.map((record) => record.id),
        {
          invalidated: true,
        }
      );

      // Insert new data.
      const now = new Date();
      const afterCooldown = new Date();
      afterCooldown.setSeconds(
        afterCooldown.getSeconds() + (ctx.config as Config).denyCooldownSeconds
      );
      ctx.database.create(DATABASE_TABLE, {
        id: null,
        created_at: now,
        expire_at: afterCooldown,
        user_id: userId,
        ticket: null,
        accepted: false,
        invalidated: false,
      });

      const text = (ctx.config as Config).message.userDenied;

      session.send(text);
    });

  // Handle join event
  ctx.on("guild-member-request", async (session) => {
    if (
      session.platform !== (ctx.config as Config).platform ||
      session.guildId !== (ctx.config as Config).genTicketIn
    )
      return;

    const records = await ctx.database.get(DATABASE_TABLE, {
      // Koishi does this inconsistency, we need to manually write platform:userId here.
      user_id: `${session.platform}:${session.userId}`,
      invalidated: false,
    });

    if (records.length <= 0) {
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
        session.bot.handleGuildMemberRequest(
          session.messageId,
          false,
          (ctx.config as Config).message.inDenyCooldown
        );
      } else {
        // After deny cooldown
        session.bot.handleGuildMemberRequest(
          session.messageId,
          false,
          (ctx.config as Config).message.noRecord
        );

        await ctx.database.set(
          DATABASE_TABLE,
          records.map((record) => record.id),
          {
            invalidated: true,
          }
        );
      }

      return;
    }

    // Accepted but expired ticket
    if (now.getTime() > someRecord.expire_at.getTime()) {
      session.bot.handleGuildMemberRequest(
        session.messageId,
        false,
        (ctx.config as Config).message.expiredTicket
      );
      return;
    }

    // Accepted but incorrect ticket
    if (!session.content.includes(someRecord.ticket)) {
      session.bot.handleGuildMemberRequest(
        session.messageId,
        false,
        (ctx.config as Config).message.invalidTicket
      );
      return;
    }

    // Finally the ticket is valid
    session.bot.handleGuildMemberRequest(session.messageId, true);
    await ctx.database.set(
      DATABASE_TABLE,
      records.map((record) => record.id),
      {
        invalidated: true,
      }
    );

    // Remove from genTicket guild
    if ((ctx.config as Config).removeAfterAccepted) {
      await session.bot.kickGuildMember(
        // Use guildId only
        (ctx.config as Config).genTicketIn,
        session.userId,
        false
      );
    }
  });
}
