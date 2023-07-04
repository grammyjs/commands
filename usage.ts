import { commands, CommandsFlavor } from "./src/context.ts";
import { Bot, Context } from "./src/deps.deno.ts";
import { Commands } from "./src/mod.ts";

const cmds = new Commands();

cmds.command("help", "Sends help")
  .localize("de-DE", "hilfe", "Sendet Hilfe")
  .addToScope("default")
  .addToScope("all_group_chats")
  .addToScope("all_private_chats")
  .addToScope("all_chat_administrators")
  .addToScope("chat_administrators", "@grammyjs")
  .addToScope("chat", "@LWJerri");

cmds.command("stats", "Sends group stats")
  .addToScope("all_group_chats")
  .addToScope("all_chat_administrators")
  .addToScope("chat_administrators", "@grammyjs")
  .addToScope("chat", "@LWJerri")
  .onChatType('private', (ctx) => ctx.reply(`Hello ${ctx.chat.first_name}!`))
  .onChatType(['group', 'supergroup', 'channel'], (ctx) => ctx.reply(`Hello members of ${ctx.chat.title}!`));

cmds.command("protocol", "Sets the protocol")
  .localize("de-DE", "protokoll", "Legt das Protokoll fest")
  .addToScope("all_chat_administrators")
  .addToScope("chat_administrators", "@grammyjs");

cmds.command("allstats", "Sends all group stats")
  .localize("de-DE", "allestats", "Sendet alle Gruppenstatistiken")
  .addToScope("chat_administrators", "@grammyjs");

cmds.command("troll", "Trolls...?")
  .addToScope("chat", "@LWJerri");

// Isn't added to any scope because it's missing the chat_id parameter
cmds.command("wrong_scope", "It's scoped wrongly")
  // @ts-expect-error
  .addToScope("chat");

Deno.writeTextFile("./scopes.json", JSON.stringify(cmds, null, 2));
Deno.writeTextFile(
  "./chat-scope.json",
  JSON.stringify(cmds.toSingleScopeArgs({ type: "chat", chat_id: "@grammyjs" }), null, 2),
);

type MyContext = CommandsFlavor<Context>;

const bot = new Bot<MyContext>("");
bot.use(commands());

bot.on(":text", async (ctx) => {
  await ctx.setMyCommands(cmds);
});

await cmds.setFor(bot);
