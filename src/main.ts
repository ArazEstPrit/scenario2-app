#!/usr/bin/env node

import { call } from "#core/actions";
import { listen } from "#core/events";
import { setup } from "#core/modules";
import {
	CommandError,
	CommandNotFoundError,
	printCommandError,
	displayHelp,
	printSetupErrors,
	run,
	printEventBusError,
} from "#core/ui/cli";

listen("event-bus:listener-error", e => {
	printEventBusError(e.payload);
});

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
