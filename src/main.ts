import { getReport, setup } from "#core/modules";
import { inspect } from "util";

await setup();

console.log("module info:", inspect(getReport(), false, null, true));
