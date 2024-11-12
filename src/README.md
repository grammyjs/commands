# grammY commands

This commands plugin for [grammY](https://grammy.dev) provides a convenient way to define and manage commands for your grammY bot.
It simplifies the process of setting up commands with scopes and localization.
Please confer the [official documentation](https://grammy.dev/plugins/commands) for this plugin to learn more about this plugin.

Here is a quickstart to get you up and running, though.

## Quickstart

You can define bot commands using the `CommandGroup` class.
Remember to register it on your bot via `bot.use`.

Finally, this plugin can call `setMyCommands` for you with the commands you defined.
That way, your users see the correct command suggestions in chats with your bot.

```ts
import { Bot } from "https://deno.land/x/grammy/mod.ts";
import { CommandGroup } from "https://deno.land/x/grammy_commands/mod.ts";

const bot = new Bot("<telegram token>");

const myCommands = new CommandGroup();

myCommands.command("start", "Initializes bot configuration")
  .localize("pt", "start", "Inicializa as configurações do bot")
  .addToScope(
    { type: "all_private_chats" },
    (ctx) => ctx.reply(`Hello, ${ctx.chat.first_name}!`),
  )
  .addToScope(
    { type: "all_group_chats" },
    (ctx) => ctx.reply(`Hello, members of ${ctx.chat.title}!`),
  );

// Calls `setMyCommands`
await myCommands.setCommands(bot);

// Registers the command handlers
bot.use(myCommands);

bot.start();
```

Be sure to check out [the documentation](https://grammy.dev/plugins/commands).
