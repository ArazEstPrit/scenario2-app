#!/usr/bin/env node

import { call } from "#core/actions";
import { setup } from "#core/modules";
import {
	CommandError,
	CommandNotFoundError,
	printCommandError,
	displayHelp,
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
			displayHelp(call("actions:help", {}));
	} else {
		throw err;
	}
}
