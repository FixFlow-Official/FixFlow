export const SCENE_WIDTH = 960;
export const SCENE_HEIGHT = 320;
export const GROUND_Y = 270;
export const RUNNER_X = 142;

export function createGame(best) {
  return {
    status: "ready",
    best,
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
  };
}
