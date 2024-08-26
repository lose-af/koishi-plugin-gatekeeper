import { Schema } from "koishi";

export interface Config {
  identifier: string;
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
    joinFailed: string;
  };
}

export const Config: Schema<Config> = Schema.object({
  identifier: Schema.string(),
  platform: Schema.string().default("onebot"),
  genTicketIn: Schema.string(),
  useTicketIn: Schema.string(),
  validForSeconds: Schema.number().default(172800),
  denyCooldownSeconds: Schema.number().default(1314000),
  removeAfterAccepted: Schema.boolean().default(false),
  message: Schema.object({
    userAccepted: Schema.string().default("您的申请已通过, Ticket: {ticket}"),
    userDenied: Schema.string().default("您没有通过审核。"),
    inDenyCooldown: Schema.string().default("请待一年冷静期后再次审核。"),
    noRecord: Schema.string().default("进入社区前请先加入审核群。"),
    invalidTicket: Schema.string().default("请正确输入入群凭证。"),
    expiredTicket: Schema.string().default("请联系审核群管理员再次发放凭证。"),
    joinFailed: Schema.string().default(
      "成员 {user} 未能成功入群，请管理员检查后重新发放凭证。"
    ),
  }),
});
