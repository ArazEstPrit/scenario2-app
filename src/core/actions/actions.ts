import type { ActionMap, ActionName, Command } from "./types.ts";

const commands = {} as Record<string, Command>;

export function register<const N extends ActionName>(command: Command<N>) {
	commands[command.name] = command;
}

export function call<const N extends ActionName>(
	commandName: N,
	args: ActionMap[N]["arguments"],
): ActionMap[N]["returns"] {
	const command = commands[commandName] as Command<N>;
	return command.execute(args);
}

register({
	name: "actions:help",
	arguments: {},
	execute() {
		return { type: "item", success: true, item: "" };
	},
});
