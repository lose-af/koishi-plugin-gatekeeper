import { Context } from "koishi";
import { DATABASE_TABLE, model } from "./database";
import { registerCommands } from "./commands";
import { registerEventHandlers } from "./events";
export { Config } from "./config";
export const name = "gatekeeper";
export const inject = ["database"];

export function apply(ctx: Context) {
  ctx.permissions.define("gatekeeper.accept", {});
  ctx.permissions.define("gatekeeper.deny", {});

  ctx.model.extend(DATABASE_TABLE, model);

  registerCommands(ctx);
  registerEventHandlers(ctx);
}
