## grammY Commands Plugin

This plugin provides a convenient way to define and manage commands for your grammY bot. It simplifies the process of
setting up commands with scopes and localization.

## Installation

This plugin is available at [deno.land/x/grammy_commands](https://deno.land/x/grammy_commands).

## Core Concepts

### The `Commands` class

The `Commands` class is the foundation of this plugin. It allows you to create commands by specifying their names and
descriptions, along with additional attributes such as scopes and localization.

### The `ctx.setMyCommands` method

The `ctx.setMyCommands` method, provided by the plugin, offers a convenient way to dynamically set the available
commands for the current chat. By invoking this method and passing an instance of the `Commands` class, you can override
the default command scopes and make all commands accessible within the current chat. This feature is particularly useful
when you need to customize the command set for specific chat contexts, ignoring the predefined scopes, which allows for
a more tailored and context-aware usage of bot commands.

## Usage

### Managing Commands For Multiple Scopes

To manage commands for multiple scopes at once, create an instance of the `Commands` class, add your commands to it, and
then call the `setFor` method of the class instance. Check out this example:

```typescript
import { Bot } from "https://deno.land/x/grammy/mod.ts";
import { Commands } from "https://deno.land/x/grammy_commands/mod.ts";

const bot = new Bot("<your_bot_token>");
const cmds = new Commands();

// Define your commands...

await cmds.setFor(bot);
```

### Managing Commands For The Current Chat

To set the commands for the current chat, you can use the `ctx.setMyCommands` method of the `Context` object. For that,
you will need to install the `CommandsFlavor` to your context, and create an instance of the `Commands` class, to which
you add your commands to and then pass to `ctx.setMyCommands`. This will override the predefined scopes and make all
commands available to the current chat. Here's an example:

> Please note that this only works in updates which have a `chat` object. If `ctx.chat` is not defined, an error will be
> thrown ar runtime.

```typescript
import { Bot, Context } from "https://deno.land/x/grammy/mod.ts";
import { Commands, CommandsFlavor } from "https://deno.land/x/grammy_commands/mod.ts";

type MyContext = CommandsFlavor<Context>;
const bot = new Bot<MyContext>("<your_bot_token>");

bot.on(":text", async (ctx: Context) => {
  const cmds = new Commands();

  // Define your commands...

  await ctx.setMyCommands(cmds);
});
```

### Defining Commands

To define a command, use the `command` method of the `CommandsPlugin` instance. The `command` method takes two
arguments: the command name and the command description. Here's an example:

```typescript
commands.command("help", "Sends help");
```

### Setting handlers

The underlying class returned by the `.command()` method extends the grammY `Composer` class. That means you can use
`.use`, `.filter`, `.branch`, `.chatType` and every other `Composer` method you already know and love. Alternatively,
you can pass your middleware as a third parameter to the `.command()` method. You can also use the `onChatType` method
of the `Command` class to define middleware specific to that chat type. Here are some examples:

#### Example 1

```typescript
commands.command("start", "Starts the bot", (ctx) => {
  ctx.reply(`Hello, ${ctx.chat?.first_name ?? "there"}!`);
});
```

#### Example 2

```typescript
commands.command("start", "Starts the bot")
  .onChatType("private", (ctx) => ctx.reply(`Hello ${ctx.chat.first_name}!`))
  .onChatType(["group", "supergroup", "channel"], (ctx) => ctx.reply(`Hello members of ${ctx.chat.title}!`))
  .addToScope("default");
```

### Localization

You can localize command names and descriptions using the `localize` method. The `localize` method takes the language
code, the localized command name, and the localized command description. Here's an example:

```typescript
commands.command("help", "Sends help")
  .localize("de-DE", "hilfe", "Sendet Hilfe");
```

### Scopes

Scopes determine the availability of each command, enabling you to control whether a command can be accessed in all
group chats, private chats, or limited to chat administrators. Commands can be assigned to different scopes using the
`addToScope` method. Here's an example:

```typescript
commands.command("help", "Sends help")
  .addToScope("default")
  .addToScope("all_group_chats")
  .addToScope("all_private_chats")
  .addToScope("all_chat_administrators")
  .addToScope("chat_administrators", "@grammyjs")
  .addToScope("chat", "@SpecificUserChat");
```

### Setting Commands for Current Chat

To set the commands for the current chat, you can use the `setMyCommands` method of the `Context` object. This will
override the defined scopes and make all commands available to the current chat. Here's an example:

```typescript
bot.on(":text", async (ctx) => {
  await ctx.setMyCommands(commands);
});
```

This will set all commands defined in the `commands` instance for the current chat.

## Examples

### Example 1: Help Command

This example shows how to define a basic help command:

```typescript
commands.command("help", "Sends help")
  .localize("de-DE", "hilfe", "Sendet Hilfe")
  .addToScope("default")
  .addToScope("all_group_chats")
  .addToScope("all_private_chats")
  .addToScope("all_chat_administrators")
  .addToScope("chat_administrators", "@grammyjs")
  .addToScope("chat", "@LWJerri");
```

### Example 2: Stats Command

This example shows how to define a stats command for group chats:

```typescript
commands.command("stats", "Sends group stats")
  .addToScope("all_group_chats")
  .addToScope("all_chat_administrators")
  .addToScope("chat_administrators", "@grammyjs")
  .addToScope("chat", "@LWJerri");
```

Feel free to add more commands and customize them according to your bot's needs.

**Note:** This plugin is designed specifically for grammY and is intended to be used with the grammY bot framework.
