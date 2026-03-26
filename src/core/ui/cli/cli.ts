import {
	type ActionResult,
	type Arguments,
	type ItemActionResult,
	type ListActionResult,
	type Argument,
	type ArrayArgument,
	type HelpActionResult,
	callAsync,
	getAction,
	RequiredArgumentMissingError,
	InvalidArgumentError,
} from "#core/actions";
import type { RawParsedCommandArguments } from "./types.ts";
import {
	CommandArgumentError,
	CommandError,
	CommandExecutionError,
	CommandNotFoundError,
} from "./errors.ts";
import { styleText } from "util";
import { getManifests, getReport } from "#core/modules";

const c = {
	dim: (s: string) => styleText("dim", s),
	bold: (s: string) => styleText("bold", s),
	cyan: (s: string) => styleText("cyan", s),
	green: (s: string) => styleText("green", s),
	yellow: (s: string) => styleText("yellow", s),
	red: (s: string) => styleText("red", s),
	blue: (s: string) => styleText("blue", s),
	magenta: (s: string) => styleText("magenta", s),
	white: (s: string) => styleText("white", s),
	gray: (s: string) => styleText("gray", s),
	italic: (s: string) => styleText("italic", s),
};

const INDENT = "  ";
const stripAnsi = (s: string) => s.replace(/\x1B\[[0-9;]*m/g, "");
const rpad = (s: string, n: number) =>
	s + " ".repeat(Math.max(0, n - stripAnsi(s).length));
const kv = (key: string, val: unknown, w = 14) =>
	`${c.gray(rpad(key, w))} ${val === undefined || val === null ? c.dim("—") : String(val)}`;

function printCauseChain(
	err: unknown,
	depth = 0,
	seen = new Set<unknown>(),
): void {
	if (err == null || seen.has(err)) return;
	seen.add(err);

	const pad = INDENT + "   " + "  ".repeat(depth);
	const prefix = depth === 0 ? "" : c.dim("caused by: ");

	if (err instanceof Error) {
		const label =
			depth === 0
				? err.message
				: `${c.dim(err.name + ":")} ${err.message}`;
		console.error(`${pad}${prefix}${label}`);
		printCauseChain(err.cause, depth + 1, seen);
	} else {
		console.error(pad + prefix + c.dim(String(err)));
	}
}

export async function run(args: string[]) {
	const { commandName, params } = parseArgs(args);

	if (!commandName) throw new CommandNotFoundError("");

	const action = getAction(commandName);
	if (!action) throw new CommandNotFoundError(commandName);

	const resolvedParams = resolveParams(params, action.arguments);

	let result;
	try {
		result = await callAsync(action.name, resolvedParams);
	} catch (err) {
		throw new CommandExecutionError(action.name, err);
	}

	if (!result.success) {
		const cause = result.error;
		if (cause instanceof RequiredArgumentMissingError)
			throw new CommandArgumentError(
				cause.argument,
				"required but not provided",
				cause,
			);
		if (cause instanceof InvalidArgumentError)
			throw new CommandArgumentError(
				cause.argument,
				cause.message,
				cause,
			);
		throw new CommandExecutionError(action.name, cause);
	}

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
		resolvedParams[arg] = resolveParamType(
			[arg]
				.concat(argDef[arg]?.aliases || [])
				.map(key => params[key])
				.find(val => val !== undefined),
			argDef[arg]!,
		);
	}

	return resolvedParams;
}

function resolveParamType(param: string | undefined, def: Argument): unknown {
	if (param === undefined) return undefined;

	switch (def.type) {
		case "string":
			return param;
		case "number":
			const num = parseFloat(param);
			return isNaN(num) ? undefined : num;
		case "boolean":
			return ["false", "f"].includes(param.toLowerCase()) ? false : true;
		case "date":
			const date = new Date(param);
			return isNaN(date.getTime()) ? undefined : date;
		case "array":
			return param
				.split(",")
				.map(e =>
					resolveParamType(e, { type: def.itemType } as Argument),
				);
		default:
			return undefined;
	}
}

export function printSetupErrors(): void {
	const report = getReport();
	if (report.failed === 0) return;

	const failed = report.moduleDetails.filter(m => !m.success);

	console.error();
	console.error(
		c.bold(
			c.red(
				`${INDENT}${failed.length} module${failed.length !== 1 ? "s" : ""} failed to load`,
			),
		),
	);
	console.error(INDENT + c.dim("─".repeat(52)));

	for (const mod of failed) {
		console.error(
			`\n${INDENT}${c.bold(c.white(mod.name))}  ${c.dim("failed at")} ${c.yellow(mod.stage)}`,
		);
		printCauseChain(mod.error);
	}

	console.error();
	console.error(
		c.dim(
			`${INDENT}${report.initialized}/${report.discovered} modules loaded  ·  setup took ${report.setupTime}ms`,
		),
	);
	console.error();
}

export function printCommandError(err: CommandError): void {
	console.error();

	if (err instanceof CommandNotFoundError) {
		const msg = err.command
			? `${c.bold("Unknown command:")} ${c.yellow(err.command)}`
			: c.bold("No command provided.");
		console.error(`${INDENT}${c.red("+")}  ${msg}`);
		console.error(
			c.dim(
				`${INDENT}   Run with no arguments to see available commands.`,
			),
		);
	} else if (err instanceof CommandArgumentError) {
		console.error(
			`${INDENT}${c.bold("Invalid argument:")} ${c.yellow(err.argument)}`,
		);
		printCauseChain(err.cause);
	} else if (err instanceof CommandExecutionError) {
		console.error(
			`${INDENT}${c.bold("Action failed:")} ${c.yellow(err.action)}`,
		);
		printCauseChain(err.cause);
	} else {
		console.error(`${INDENT}${c.red("+")}  ${err.message}`);
		printCauseChain(err.cause);
	}

	console.error();
}

function displayResult(result: ActionResult) {
	switch (result.type) {
		case "void":
			break;
		case "item":
			displayItem(result);
			break;
		case "list":
			displayList(result);
			break;
		case "help":
			displayHelp(result);
			break;
	}
}

function displayItem(result: ItemActionResult<unknown>) {
	const data = result.data as Record<string, unknown>;
	if (typeof data !== "object" || data === null) {
		console.log(String(data));
		return;
	}
	console.log(c.bold("Result:"));
	for (const [k, v] of Object.entries(data))
		console.log(kv(k, formatValue(v)));
}

function displayList(result: ListActionResult<unknown>) {
	const { data } = result;

	if (!data.length) {
		console.log(c.dim("(no items)"));
		return;
	}

	const first = data[0];
	if (typeof first !== "object" || first === null) {
		data.forEach(r => console.log(`${INDENT}- ${formatValue(r)}`));
		return;
	}

	const rows = data as Record<string, unknown>[];
	const keys = Object.keys(first as object);
	const colWidths = keys.map(k =>
		Math.min(
			40,
			Math.max(
				k.length,
				...rows.map(r => stripAnsi(formatValue(r[k])).length),
			),
		),
	);

	console.log(
		keys
			.map((k, i) => rpad(c.bold(c.cyan(k)), colWidths[i]!))
			.join(c.dim("  ")),
	);
	console.log(colWidths.map(w => c.dim("─".repeat(w))).join(c.dim("  ")));
	for (const row of rows)
		console.log(
			keys
				.map((k, i) =>
					rpad(colourCell(k, formatValue(row[k])), colWidths[i]!),
				)
				.join(c.dim("  ")),
		);
	console.log(
		c.dim(
			`\n${INDENT}${rows.length} item${rows.length !== 1 ? "s" : ""}\n`,
		),
	);
}

function formatValue(v: unknown): string {
	if (v === null || v === undefined) return "—";
	if (v instanceof Date)
		return v.toLocaleDateString("en-GB", {
			day: "2-digit",
			month: "short",
			year: "numeric",
		});
	if (typeof v === "boolean") return v ? "yes" : "no";
	if (Array.isArray(v)) return v.map(formatValue).join(", ");
	if (typeof v === "number") return String(v);
	return String(v);
}

function colourCell(key: string, value: string): string {
	if (key === "completed" || key === "done")
		return value === "yes" ? c.green(value) : c.dim(value);
	if (key === "score" || key === "priority") {
		const n = parseFloat(value);
		if (!isNaN(n))
			return n >= 10
				? c.red(value)
				: n >= 5
					? c.yellow(value)
					: c.green(value);
	}
	if (key === "importance" || key === "effort") {
		const n = parseInt(value);
		if (!isNaN(n))
			return n >= 5 ? c.red(value) : n >= 3 ? c.yellow(value) : value;
	}
	if (key === "name") return c.white(value);
	if (key === "id") return c.dim(value);
	if (key.toLowerCase().includes("date")) return c.cyan(value);
	return value;
}

export function displayHelp(result: HelpActionResult) {
	const actions = result.data;
	const groups = new Map<string, typeof actions>();
	for (const action of actions) {
		const ns = action.name.split(":")[0]!;
		if (!groups.has(ns)) groups.set(ns, []);
		groups.get(ns)!.push(action);
	}

	if (actions.length != 1) {
		console.log();
		console.log(
			c.bold(c.cyan(`${INDENT}┌───────────────────────────────┐`)),
		);
		console.log(
			c.bold(c.cyan(`${INDENT}│       Available Actions       │`)),
		);
		console.log(
			c.bold(c.cyan(`${INDENT}└───────────────────────────────┘`)),
		);
	}

	for (const [ns, cmds] of groups) {
		console.log();
		const displayName = getManifests().find(m => m.name == ns)?.displayName;
		console.log(
			c.bold(c.magenta(`${INDENT}${ns}`)),
			displayName ? `- ${c.bold(displayName)}` : "",
		);
		console.log(c.dim(`${INDENT}${"─".repeat(50)}`));

		for (const action of cmds) {
			const aliases = action.aliases?.length
				? c.dim(` [${action.aliases.join(", ")}]`)
				: "";
			const displayName = action.displayName
				? c.dim(" — ") + c.white(action.displayName)
				: "";
			console.log(
				`${INDENT}  ${c.cyan(action.name)}${displayName}${aliases}`,
			);

			if (action.description)
				console.log(`${INDENT}    ${c.dim(action.description)}`);

			for (const [key, def] of Object.entries(action.arguments)) {
				const req = def.optional ? c.dim("?") : c.red("*");
				const type = c.yellow(
					def.type === "array"
						? (def as ArrayArgument).itemType + "[]"
						: def.type,
				);
				const alias = def.aliases?.length
					? c.dim(` (-${def.aliases.join(", -")})`)
					: "";
				const dflt =
					def.default !== undefined ? c.dim(` = ${def.default}`) : "";
				const description = def.description && c.dim(def.description);
				console.log(
					`${INDENT}    ${req} ${c.white("--" + key)}${alias} ${c.dim("<")}${type}${c.dim(">")}${dflt}`,
				);
				if (description) console.log(`${INDENT}      ${description}`);
			}
			console.log();
		}
	}
}
