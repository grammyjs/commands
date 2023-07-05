import { Command, CommandCollection } from "./src/mod.ts";

const helpCommand = new Command("help", "Sends help")
  .localize("de-DE", "hilfe", "Sendet Hilfe")
  .addToScope("default")
  .addToScope("all_group_chats")
  .addToScope("all_private_chats")
  .addToScope("all_chat_administrators")
  .addToScope("chat_administrators", "@grammyjs")
  .addToScope("chat", "@LWJerri");

const statsCommand = new Command("stats", "Sends group stats")
  .addToScope("all_group_chats")
  .addToScope("all_chat_administrators")
  .addToScope("chat_administrators", "@grammyjs")
  .addToScope("chat", "@LWJerri");

const protocolCommand = new Command("protocol", "Sets the protocol")
  .localize("de-DE", "protokoll", "Legt das Protokoll fest")
  .addToScope("all_chat_administrators")
  .addToScope("chat_administrators", "@grammyjs");

const allStatsCommand = new Command("allstats", "Sends all group stats")
  .localize("de-DE", "allestats", "Sendet alle Gruppenstatistiken")
  .addToScope("chat_administrators", "@grammyjs");

const trollCommand = new Command("troll", "Trolls...?")
  .addToScope("chat", "@LWJerri");

const commands = new CommandCollection([
  helpCommand,
  statsCommand,
  protocolCommand,
  allStatsCommand,
  trollCommand,
]);

Deno.writeTextFile("./scopes.json", JSON.stringify(commands, null, 2));
