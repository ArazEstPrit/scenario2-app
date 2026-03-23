import { getReport, setup } from "#core/modules";

await setup();

const report = getReport();
if (report.errors.length > 0) {
	console.log("Module Errors:", ...report.errors);
}
