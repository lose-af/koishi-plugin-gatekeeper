import { Context } from "koishi";

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
  user_id: string;
  ticket: string;
  accepted: boolean;
  invalidated: boolean;
}

export const model = {
  id: { type: "unsigned", nullable: false },
  created_at: { type: "timestamp", nullable: false },
  expire_at: { type: "timestamp", nullable: true },
  user_id: { type: "string", nullable: false },
  ticket: { type: "string", nullable: true },
  accepted: { type: "boolean", nullable: false },
  invalidated: { type: "boolean", nullable: false },
} as const;

export async function invalidateOldRecords(ctx: Context, userId: string) {
  const records = await ctx.database.get(DATABASE_TABLE, {
    user_id: userId,
    invalidated: false,
  });

  await ctx.database.set(
    DATABASE_TABLE,
    records.map((record) => record.id),
    { invalidated: true }
  );
}

export async function insertNewRecord(ctx: Context, data: GatekeeperModel) {
  return ctx.database.create(DATABASE_TABLE, data);
}

export async function fetchUserRecords(ctx: Context, userId: string) {
  return ctx.database.get(DATABASE_TABLE, {
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
