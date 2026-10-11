// Exercise the actual TypeScript publisher in Node, replacing only Vite's virtual seed
// module with its two real path functions (BASE_URL is / for this site).
import { readFileSync } from "node:fs";
import ts from "typescript";
const moduleUrl = (text) => `data:text/javascript;base64,${Buffer.from(text).toString("base64")}`;
const compile = (path) => ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const github = moduleUrl(compile("src/lib/github.ts"));
const seed = moduleUrl([...readFileSync("src/lib/seed.ts", "utf8").matchAll(/export function media(?:Url|Path)\([^]*?\n\}/g)].map((match) => ts.transpileModule(match[0].replaceAll("import.meta.env.BASE_URL", '"/"'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText).join("\n"));
const types = moduleUrl(compile("src/lib/types.ts"));
export const publisher = await import(moduleUrl(compile("src/lib/publish.ts").replace('"@/lib/github"', JSON.stringify(github)).replace('"@/lib/seed"', JSON.stringify(seed)).replace('"@/lib/types"', JSON.stringify(types))));
export const gitApi = await import(github);
