import { Context } from "koishi";
import { Config } from "./config";

export const DATABASE_TABLE = "gatekeeper";

declare module "koishi" {
  interface Tables {
    [DATABASE_TABLE]: GatekeeperModel;
  }
}

export interface GatekeeperModel {
  id: number;
  created_at: Date;
  expire_at: Date;
  identifier: string;
  user_id: string;
  ticket: string;
  accepted: boolean;
  invalidated: boolean;
}

export const model = {
  id: { type: "unsigned", nullable: false },
  created_at: { type: "timestamp", nullable: false },
  expire_at: { type: "timestamp", nullable: true },
  identifier: { type: "string", nullable: false },
  user_id: { type: "string", nullable: false },
  ticket: { type: "string", nullable: true },
  accepted: { type: "boolean", nullable: false },
  invalidated: { type: "boolean", nullable: false },
} as const;

export async function invalidateOldRecords(
  ctx: Context,
  identifier: string,
  userId: string
) {
  const records = await ctx.database.get(DATABASE_TABLE, {
    identifier: identifier,
    user_id: userId,
    invalidated: false,
  });

  await ctx.database.set(
    DATABASE_TABLE,
    records.map((record) => record.id),
    { invalidated: true }
  );
}

export async function insertNewRecord(
  ctx: Context,
  identifier: string,
  data: Pick<GatekeeperModel, "accepted" | "ticket" | "user_id">
) {
  const expiresInSeconds = data.accepted
    ? (ctx.config as Config).validForSeconds
    : (ctx.config as Config).denyCooldownSeconds;

  const expireAt = new Date();
  expireAt.setSeconds(expireAt.getSeconds() + expiresInSeconds);

  return ctx.database.create(DATABASE_TABLE, {
    id: null,
    created_at: new Date(),
    expire_at: expireAt,
    identifier: identifier,
    accepted: data.accepted,
    ticket: data.ticket,
    user_id: data.user_id,
    invalidated: false,
  });
}

export async function fetchUserRecords(
  ctx: Context,
  identifier: string,
  userId: string
) {
  return ctx.database.get(DATABASE_TABLE, {
    identifier: identifier,
    user_id: userId,
    invalidated: false,
  });
}

export async function updateUserRecords(
  ctx: Context,
  ids: number[],
  updateData: Partial<GatekeeperModel>
) {
  return ctx.database.set(DATABASE_TABLE, ids, updateData);
}
