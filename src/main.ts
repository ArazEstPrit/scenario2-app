#!/usr/bin/env node

import { call } from "#core/actions";
import { setup } from "#core/modules";
import {
	CommandError,
	CommandNotFoundError,
	printCommandError,
	printHelp,
	printSetupErrors,
	run,
} from "#core/ui/cli";

await setup();

printSetupErrors();

try {
	await run(process.argv.slice(2));
} catch (err) {
	if (err instanceof CommandError) {
		printCommandError(err);
		if (err instanceof CommandNotFoundError)
			printHelp(call("actions:help", {}).data);
	} else {
		throw err;
	}
}
