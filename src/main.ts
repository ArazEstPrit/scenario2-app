import { call } from "#core/actions";
import { getReport, setup } from "#core/modules";
import { run } from "#core/ui/cli";

await setup();

const report = getReport();
if (report.errors.length > 0) {
	console.log("Module setup errors:", ...report.errors);
}

try {
	await run(process.argv.slice(2));
} catch (error) {
	console.error(error);
	console.log(call("actions:help", {}).data);
}
