## grammY Commands Plugin

This plugin provides a convenient way to define and manage commands for your grammY bot. It simplifies the process of
setting up commands with scopes and localization.

## Usage

The main functionality of this plugin is to define your commands, localize them, and give them handlers for each
[scope](https://core.telegram.org/bots/api#botcommandscope), like so:

```typescript
import { Bot } from "https://deno.land/x/grammy/mod.ts";
import { Commands } from "https://deno.land/x/grammy_commands/mod.ts";

const bot = new Bot("<telegram token>");

const myCommands = new Commands();

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

It is very important that you call `bot.use` with your instance of the `Commands` class. Otherwise, the command handlers
will not be registered, and your bot will not respond to those commands.

### Context shortcuts

This plugin provides a shortcut for setting the commands for the current chat. To use it, you need to install the
commands flavor and the plugin itself, like so:

```typescript
import { Bot, Context } from "https://deno.land/x/grammy/mod.ts";
import {
    Commands,
    commands,
    CommandsFlavor,
} from "https://deno.land/x/grammy_commands/mod.ts";

type BotContext = CommandsFlavor;

const bot = new Bot<BotContext>("<telegram_token>");
bot.use(commands());

bot.on("message", async (ctx) => {
    const cmds = new Commands();

    cmds.command("start", "Initializes bot configuration")
        .localize("pt", "start", "Inicializa as configurações do bot");

    await ctx.setMyCommands(cmds);

    return ctx.reply("Commands set!");
});

bot.start();
```
