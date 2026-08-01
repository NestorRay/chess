import { expect, test } from "@playwright/test";

test("two guests join, play, reconnect, and open replay", async ({ browser }) => {
  const redContext = await browser.newContext();
  const blackContext = await browser.newContext();
  const red = await redContext.newPage();
  const black = await blackContext.newPage();

  await red.goto("/");
  await red.getByLabel("你的昵称").fill("红方测试员");
  await red.getByRole("button", { name: "创建新对局" }).click();
  const code = (await red.locator(".game-code").textContent())!.trim();
  await expect(red.getByText("等待另一位棋手加入")).toBeVisible();

  await black.goto("/");
  await black.getByLabel("你的昵称").fill("黑方测试员");
  await black.getByLabel("六位对局码").fill(code);
  await black.getByRole("button", { name: "加入对局" }).click();
  await expect(black.getByText("红方测试员")).toBeVisible();
  await expect(red.getByText("黑方测试员")).toBeVisible();

  await red.locator('[aria-label="a0 车"]').click();
  await red.locator('[aria-label="a1 可落子"]').click();
  await expect(black.getByText("轮到你落子")).toBeVisible();

  await black.reload();
  await expect(black.getByText("轮到你落子")).toBeVisible();
  black.on("dialog", (dialog) => dialog.accept());
  await black.getByRole("button", { name: "认输" }).click();
  await expect(red.getByText(/红方胜/)).toBeVisible();
  await red.getByRole("link", { name: "查看本局复盘" }).click();
  await expect(red.getByText("着法列表")).toBeVisible();
  await expect(red.locator(".move-list li")).toHaveCount(1);

  await redContext.close();
  await blackContext.close();
});
