import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the milk tea game shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>摇摇奶茶大合成<\/title>/);
  assert.match(html, /class="game-shell"/);
  assert.match(html, /aria-label="game canvas"/);
  assert.match(html, /开始游戏/);
  assert.match(html, /查看排行榜/);
  assert.match(html, /按住屏幕滑动/);
  assert.match(html, /三连斜插/);
  assert.match(html, /\/generated-assets\/topping-sago\.png/);
  assert.match(html, /\/generated-assets\/scene-milk-tea-cup\.png/);
  assert.doesNotMatch(html, /scene-milk-tea-cup\.svg|scene-straw\.svg/);
});

test("uses sticker PNG production assets", async () => {
  const assetIndex = await readFile(
    new URL("../app/image-assets/index.ts", import.meta.url),
    "utf8",
  );
  const milkTeaGame = await readFile(
    new URL("../app/milk-tea-game.tsx", import.meta.url),
    "utf8",
  );
  const expectedAssets = [
    "topping-sago",
    "topping-mango",
    "topping-coconut",
    "topping-boba",
    "topping-red-bean",
    "topping-pudding",
    "topping-grass-jelly",
    "topping-taro-ball",
    "topping-cheese-foam",
    "topping-persimmon",
    "scene-milk-tea-cup",
    "scene-straw",
  ];

  for (const asset of expectedAssets) {
    await access(new URL(`../public/generated-assets/${asset}.png`, import.meta.url));
  }

  assert.match(assetIndex, /kawaii hand-account sticker/);
  assert.match(assetIndex, /fileName: "scene-milk-tea-cup\.png"/);
  assert.match(assetIndex, /fileName: "scene-straw\.png"/);
  assert.match(milkTeaGame, /PLAYER_SPEED_MULTIPLIER = 2/);
  assert.match(milkTeaGame, /function makeStrawStabs/);
  assert.match(milkTeaGame, /jabMs \* 3/);
});
