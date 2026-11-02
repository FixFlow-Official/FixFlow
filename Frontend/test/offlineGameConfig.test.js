import assert from "node:assert/strict";
import test from "node:test";
import {
  GROUND_Y,
  RUNNER_X,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  createGame,
} from "../src/features/offline/campusDashConfig.js";

test("offline game starts in a clean ready state with the saved best score", () => {
  const game = createGame(27);

  assert.deepEqual(game, {
    status: "ready",
    best: 27,
    score: 0,
    distance: 0,
    elapsed: 0,
    collected: 0,
    speed: 300,
    runnerBottom: GROUND_Y,
    runnerVelocity: 0,
    hazards: [],
    tools: [],
    hazardTimer: 1.2,
    toolTimer: 2.4,
  });
  assert.notEqual(game.hazards, createGame(0).hazards, "game instances should not share mutable arrays");
});

test("canvas geometry keeps the runner and ground within the scene", () => {
  assert.ok(SCENE_WIDTH > RUNNER_X);
  assert.ok(SCENE_HEIGHT > GROUND_Y);
  assert.ok(RUNNER_X > 0);
});
