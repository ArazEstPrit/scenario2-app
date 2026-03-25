import {
	type Action,
	type ActionName,
	type ActionResult,
	type Arguments,
	callAsync,
	getAction,
	type ItemActionResult,
	type ListActionResult,
} from "#core/actions";
import type { RawParsedCommandArguments } from "./types.ts";
import { CommandError } from "./errors.ts";

const commands = new Map<string, Action>();

export function registerCommand<N extends ActionName>(name: N) {
	const action = getAction(name);
	if (!action) return;
	commands.set(name, action);
	action.aliases?.forEach(a => commands.set(a, action));
}

export async function run(args: string[]) {
	const { commandName, params } = parseArgs(args);
	if (!commandName) throw new CommandError("No command provided!");
	const action = commands.get(commandName);
	if (!action) throw new CommandError("Command not found! " + commandName);
	const resolvedParams = resolveParams(params, action.arguments);
	const result = await callAsync(action.name, resolvedParams);
	displayResult(result);
}

function parseArgs(args: string[]): RawParsedCommandArguments {
	const commandName = args.shift();

	const removeQuotes = (a: string) =>
		['""', "''"].includes(a.slice(0, 1) + a.slice(-1)) ? a.slice(1, -1) : a;

	return args.reduce(
		(parsed, arg) => {
			if (arg.startsWith("-")) {
				const [optionName, rawOptionValue] = arg
					.replace(/^-+/, "")
					.split("=");

				if (!optionName) return parsed;

				// If `rawArgumentValue` is undefined, that means that the user
				// inputted the option as `--option` without `=value`. This is
				// interpreted like `--option=true`
				const optionValue = rawOptionValue || "true";

				parsed.params[optionName] = removeQuotes(optionValue);
			}

			return parsed;
		},
		{
			commandName: commandName,
			params: {},
		} as RawParsedCommandArguments,
	);
}

function resolveParams(
	params: RawParsedCommandArguments["params"],
	argDef: Arguments,
): Record<string, unknown> {
	const resolvedParams = {} as Record<string, unknown>;

	for (const arg of Object.keys(argDef)) {
		resolvedParams[arg] = params[arg];
	}

	return resolvedParams;
}

function displayResult(result: ActionResult) {
	if (!result.success)
		console.error("Error occured while running command:", result.error);

	switch (result.type) {
		case "void":
			break;
		case "item":
			displayItem(result);
			break;
		case "list":
			displayList(result);
			break;
	}
}

function displayItem(result: ItemActionResult<unknown>) {
	console.log(result.data);
}

function displayList(result: ListActionResult<unknown>) {
	for (const res of result.data) {
		console.log(res);
	}
}
