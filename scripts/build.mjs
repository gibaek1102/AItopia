// src/main.tsx 를 번들해 scripts/template.html 에 넣고, 루트 index.html 을 만든다.
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";

const out = await build({
  entryPoints: ["src/main.tsx"], bundle: true, minify: true, write: false,
  jsx: "automatic", format: "iife", target: "es2019", logLevel: "warning",
});
const js = out.outputFiles[0].text.replace(/<\/script>/g, "<\\/script>");
const tpl = readFileSync("scripts/template.html", "utf8");
writeFileSync("index.html", tpl.replace("/*__BUNDLE__*/", () => js));
console.log("index.html 생성 완료");
