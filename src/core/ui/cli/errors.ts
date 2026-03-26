import type { ActionError } from "#core/actions";

export class CommandError extends Error {
	constructor(message: string, cause?: unknown) {
		super(message, { cause });
		this.name = "CommandError";
	}
}

export class CommandNotFoundError extends CommandError {
	readonly command: string;
	constructor(command: string) {
		super(
			command
				? `Unknown command "${command}". Run with no arguments to see available commands.`
				: "No command provided. Run with no arguments to see available commands.",
		);
		this.name = "CommandNotFoundError";
		this.command = command;
	}
}

export class CommandArgumentError extends CommandError {
	readonly argument: string;
	constructor(argument: string, reason: string, cause?: ActionError) {
		super(`Bad argument "${argument}": ${reason}`, cause);
		this.name = "CommandArgumentError";
		this.argument = argument;
	}
}

export class CommandExecutionError extends CommandError {
	readonly action: string;
	constructor(action: string, cause?: unknown) {
		super(`Action "${action}" failed during execution.`, cause);
		this.name = "CommandExecutionError";
		this.action = action;
	}
}
