import { cp, mkdir, rm, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const output = new URL("../dist/pages/", import.meta.url);
const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("pages", `${Date.now()}`);

await rm(output, { recursive: true, force: true });
await mkdir(new URL("assets/", output), { recursive: true });
await cp(new URL("../dist/client/assets/", import.meta.url), new URL("assets/", output), {
  recursive: true,
});
await cp(new URL("../dist/client/favicon.svg", import.meta.url), new URL("favicon.svg", output));

const { default: worker } = await import(workerUrl.href);

async function render(pathname, destination) {
  const response = await worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );

  if (!response.ok) throw new Error(`Failed to render ${pathname}: ${response.status}`);
  const file = new URL(destination, output);
  await mkdir(new URL("./", file), { recursive: true });
  await writeFile(file, await response.text(), "utf8");
}

await render("/", "index.html");
await render("/final-call", "final-call/index.html");
await writeFile(new URL(".nojekyll", output), "", "utf8");

console.log(`GitHub Pages files created in ${output.pathname.replace(root.pathname, "")}`);
