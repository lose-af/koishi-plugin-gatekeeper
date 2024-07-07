import { Context } from "koishi";
import { DATABASE_TABLE, model } from "./database";
import { registerCommands } from "./commands";
import { registerEventHandlers } from "./events";
import { Config } from "./config";

export { Config } from "./config";

export const name = "gatekeeper";
export const reusable = true;
export const inject = ["database"];

export function apply(ctx: Context) {
  ctx.permissions.define(
    `gatekeeper.${(ctx.config as Config).identifier}.accept`,
    {}
  );
  ctx.permissions.define(
    `gatekeeper.${(ctx.config as Config).identifier}.deny`,
    {}
  );

  ctx.model.extend(DATABASE_TABLE, model);

  registerCommands(ctx);
  registerEventHandlers(ctx);
}
