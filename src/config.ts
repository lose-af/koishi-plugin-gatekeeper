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
  };
}

export const Config: Schema<Config> = Schema.object({
  identifier: Schema.string().required(true),
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
