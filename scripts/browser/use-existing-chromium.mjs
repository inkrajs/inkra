// Test-only launcher selection. No package install, version impersonation or
// assertion changes: use the explicitly supplied existing executable.
import {createRequire} from 'node:module';import{pathToFileURL}from'node:url';
if(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE){const require=createRequire(import.meta.url);const entry=require.resolve('playwright',{paths:[process.cwd()]});const imported=await import(pathToFileURL(entry));const api=imported.default??imported;const original=api.chromium.launch.bind(api.chromium);api.chromium.launch=options=>original({...options,executablePath:options?.executablePath||process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});}
