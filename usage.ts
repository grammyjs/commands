import { Command, CommandScope } from "./src/mod.ts";

const helpCommand = new Command("help", "Sends help")
  .localize("de-DE", "hilfe", "Sendet Hilfe");

const statsCommand = new Command("stats", "Sends group stats");
const protocolCommand = new Command("protocol", "Sets the protocol")
  .localize("de-DE", "protokoll", "Legt das Protokoll fest");
const allStatsCommand = new Command("allstats", "Sends all group stats")
  .localize("de-DE", "allestats", "Sendet alle Gruppenstatistiken");
const trollCommand = new Command("troll", "Trolls...?");

const defaultScope = CommandScope.default().add(helpCommand);
const groupScope = CommandScope.groups().add([helpCommand, statsCommand]);
const adminsScope = CommandScope.admins().add([helpCommand, statsCommand, protocolCommand]);
const grammyMembersScope = CommandScope.chat("@grammyjs").add([helpCommand, statsCommand]);
const grammyAdminsScope = CommandScope.chat("@grammyjs").add([helpCommand, statsCommand, allStatsCommand]);
const lwjerryScope = CommandScope.chat("@lwjerry").add([helpCommand, trollCommand]);

const scopes = [
  defaultScope,
  groupScope,
  adminsScope,
  grammyMembersScope,
  grammyAdminsScope,
  lwjerryScope,
];

for (const scope of scopes) {
  console.log(scope.toParams());
}

/**
 * [
 *   {
 *     scope: { type: "default" },
 *     language_code: "de-DE",
 *     commands: [ { command: "hilfe", description: "Sendet Hilfe" } ]
 *   },
 *   {
 *     scope: { type: "default" },
 *     language_code: undefined,
 *     commands: [ { command: "help", description: "Sends help" } ]
 *   }
 * ]
 * [
 *   {
 *     scope: { type: "all_group_chats" },
 *     language_code: "de-DE",
 *     commands: [
 *       { command: "hilfe", description: "Sendet Hilfe" },
 *       { command: "stats", description: "Sends group stats" }
 *     ]
 *   },
 *   {
 *     scope: { type: "all_group_chats" },
 *     language_code: undefined,
 *     commands: [
 *       { command: "help", description: "Sends help" },
 *       { command: "stats", description: "Sends group stats" }
 *     ]
 *   }
 * ]
 * [
 *   {
 *     scope: { type: "all_chat_administrators" },
 *     language_code: "de-DE",
 *     commands: [
 *       { command: "hilfe", description: "Sendet Hilfe" },
 *       { command: "stats", description: "Sends group stats" },
 *       { command: "protokoll", description: "Legt das Protokoll fest" }
 *     ]
 *   },
 *   {
 *     scope: { type: "all_chat_administrators" },
 *     language_code: undefined,
 *     commands: [
 *       { command: "help", description: "Sends help" },
 *       { command: "stats", description: "Sends group stats" },
 *       { command: "protocol", description: "Sets the protocol" }
 *     ]
 *   }
 * ]
 * [
 *   {
 *     scope: { type: "chat", chat_id: "@grammyjs" },
 *     language_code: "de-DE",
 *     commands: [
 *       { command: "hilfe", description: "Sendet Hilfe" },
 *       { command: "stats", description: "Sends group stats" }
 *     ]
 *   },
 *   {
 *     scope: { type: "chat", chat_id: "@grammyjs" },
 *     language_code: undefined,
 *     commands: [
 *       { command: "help", description: "Sends help" },
 *       { command: "stats", description: "Sends group stats" }
 *     ]
 *   }
 * ]
 * [
 *   {
 *     scope: { type: "chat", chat_id: "@grammyjs" },
 *     language_code: "de-DE",
 *     commands: [
 *       { command: "hilfe", description: "Sendet Hilfe" },
 *       { command: "stats", description: "Sends group stats" },
 *       {
 *         command: "allestats",
 *         description: "Sendet alle Gruppenstatistiken"
 *       }
 *     ]
 *   },
 *   {
 *     scope: { type: "chat", chat_id: "@grammyjs" },
 *     language_code: undefined,
 *     commands: [
 *       { command: "help", description: "Sends help" },
 *       { command: "stats", description: "Sends group stats" },
 *       { command: "allstats", description: "Sends all group stats" }
 *     ]
 *   }
 * ]
 * [
 *   {
 *     scope: { type: "chat", chat_id: "@lwjerry" },
 *     language_code: "de-DE",
 *     commands: [
 *       { command: "hilfe", description: "Sendet Hilfe" },
 *       { command: "troll", description: "Trolls...?" }
 *     ]
 *   },
 *   {
 *     scope: { type: "chat", chat_id: "@lwjerry" },
 *     language_code: undefined,
 *     commands: [
 *       { command: "help", description: "Sends help" },
 *       { command: "troll", description: "Trolls...?" }
 *     ]
 *   }
 * ]
 */
