import { useEffect, useRef } from "react";
import { GROUND_Y, RUNNER_X, SCENE_HEIGHT, SCENE_WIDTH } from "./campusDashConfig.js";

function roundedRect(ctx, x, y, width, height, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

function drawCampus(ctx, distance) {
  const sky = ctx.createLinearGradient(0, 0, 0, SCENE_HEIGHT);
  sky.addColorStop(0, "#dff5f2");
  sky.addColorStop(1, "#f8fbf3");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);

  ctx.fillStyle = "#ffd77c";
  ctx.beginPath();
  ctx.arc(790, 58, 27, 0, Math.PI * 2);
  ctx.fill();

  // Long, tiled parallax layers make the loop seamless and much less repetitive.
  const campusTileWidth = 1920;
  const buildingOffset = (distance * 0.12) % campusTileWidth;
  const buildings = [
    { x: 30, width: 245, height: 110, color: "#c4ddd6" },
    { x: 335, width: 180, height: 82, color: "#d0e5df" },
    { x: 585, width: 285, height: 132, color: "#bfd9d3" },
    { x: 940, width: 205, height: 96, color: "#d1e5df" },
    { x: 1210, width: 300, height: 118, color: "#c4ddd6" },
    { x: 1570, width: 260, height: 88, color: "#d0e5df" },
  ];
  for (let tile = -1; tile <= 1; tile += 1) {
    const tileX = tile * campusTileWidth - buildingOffset;
    buildings.forEach((building, buildingIndex) => {
      const x = tileX + building.x;
      const top = GROUND_Y - building.height;
      roundedRect(ctx, x, top, building.width, building.height, 10, building.color);
      roundedRect(ctx, x + 18, top - 13, 66 + (buildingIndex % 2) * 22, 13, 5, "#8dbab1");
      ctx.fillStyle = buildingIndex % 2 ? "#f5faf7" : "#eaf5f0";
      for (let windowX = x + 24; windowX < x + building.width - 18; windowX += 43) {
        for (let windowY = top + 20; windowY < GROUND_Y - 18; windowY += 29) {
          ctx.fillRect(windowX, windowY, 17, 12);
        }
      }
      ctx.fillStyle = "#a6c9bf";
      ctx.fillRect(x + building.width * 0.48, GROUND_Y - 39, 28, 39);
    });
  }

  // A second, faster layer with varied trees provides depth without image assets.
  const treeTileWidth = 2700;
  const treeOffset = (distance * 0.34) % treeTileWidth;
  const trees = [70, 270, 480, 700, 940, 1180, 1400, 1640, 1870, 2100, 2320, 2530];
  for (let tile = -1; tile <= 1; tile += 1) {
    const tileX = tile * treeTileWidth - treeOffset;
    trees.forEach((treeX, index) => {
      const x = tileX + treeX;
      const height = 52 + (index % 3) * 8;
      ctx.fillStyle = "#795842";
      ctx.fillRect(x + 17, GROUND_Y - height, 10, height);
      ctx.fillStyle = index % 2 ? "#538f70" : "#5a9b76";
      ctx.beginPath();
      ctx.arc(x + 22, GROUND_Y - height - 8, 25 + (index % 2) * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#79b989";
      ctx.beginPath();
      ctx.arc(x + 8, GROUND_Y - height - 16, 13, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  ctx.fillStyle = "#d5cbb4";
  ctx.fillRect(0, GROUND_Y, SCENE_WIDTH, 10);
  ctx.fillStyle = "#e7dfce";
  ctx.fillRect(0, GROUND_Y + 10, SCENE_WIDTH, SCENE_HEIGHT - GROUND_Y - 10);
  ctx.fillStyle = "#c5b99f";
  ctx.fillRect(0, GROUND_Y + 10, SCENE_WIDTH, 4);

  const roadOffset = distance % 420;
  ctx.fillStyle = "#c8bda7";
  for (let x = -roadOffset; x < SCENE_WIDTH; x += 420) {
    ctx.fillRect(x + 18, GROUND_Y + 44, 78, 4);
    ctx.fillRect(x + 208, GROUND_Y + 68, 24, 3);
    ctx.fillRect(x + 330, GROUND_Y + 34, 16, 3);
  }
}

function drawRunner(ctx, bottom, runningFrame, isRunning) {
  const stride = isRunning ? Math.sin(runningFrame * 0.018) * 9 : 0;
  const top = bottom - 57;

  // Legs
  ctx.strokeStyle = "#263b3a";
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(RUNNER_X - 4, bottom - 15);
  ctx.lineTo(RUNNER_X - 13 + stride, bottom - 2);
  ctx.lineTo(RUNNER_X - 4 + stride, bottom - 1);
  ctx.moveTo(RUNNER_X + 9, bottom - 15);
  ctx.lineTo(RUNNER_X + 18 - stride, bottom - 7);
  ctx.lineTo(RUNNER_X + 27 - stride, bottom - 7);
  ctx.stroke();

  // Body and reflective safety vest
  roundedRect(ctx, RUNNER_X - 17, top + 16, 39, 34, 11, "#187766");
  roundedRect(ctx, RUNNER_X - 6, top + 18, 9, 29, 3, "#f4d85e");
  roundedRect(ctx, RUNNER_X + 8, top + 18, 6, 29, 3, "#f4d85e");

  // Tool belt
  roundedRect(ctx, RUNNER_X - 18, top + 43, 43, 10, 4, "#31403f");
  ctx.fillStyle = "#ed9b43";
  ctx.fillRect(RUNNER_X + 8, top + 42, 7, 12);

  // Head and hair
  ctx.fillStyle = "#d9956c";
  ctx.beginPath();
  ctx.arc(RUNNER_X + 3, top + 7, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#243a36";
  ctx.beginPath();
  ctx.arc(RUNNER_X + 1, top + 2, 15, Math.PI, Math.PI * 2);
  ctx.lineTo(RUNNER_X + 15, top + 8);
  ctx.quadraticCurveTo(RUNNER_X + 4, top + 1, RUNNER_X - 9, top + 10);
  ctx.closePath();
  ctx.fill();

  // Arms
  ctx.strokeStyle = "#187766";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(RUNNER_X - 12, top + 24);
  ctx.lineTo(RUNNER_X - 27, top + 34 + stride * 0.35);
  ctx.moveTo(RUNNER_X + 17, top + 23);
  ctx.lineTo(RUNNER_X + 30, top + 13 - stride * 0.35);
  ctx.stroke();
}

function drawHazard(ctx, hazard) {
  if (hazard.kind === "toolbox") {
    const x = hazard.x;
    const y = GROUND_Y - hazard.height;
    roundedRect(ctx, x + 3, y + 5, hazard.width, hazard.height - 4, 5, "#a85637");
    roundedRect(ctx, x, y, hazard.width, 13, 4, "#d27a4c");
    ctx.fillStyle = "#e9b657";
    ctx.fillRect(x + 8, y + 22, hazard.width - 16, 5);
    ctx.fillRect(x + hazard.width * 0.45, y + 13, 10, 17);
    ctx.fillStyle = "#5a4840";
    ctx.fillRect(x + hazard.width * 0.45 + 2, y + 17, 6, 8);
    ctx.fillStyle = "#71432f";
    ctx.fillRect(x + 7, y + hazard.height - 8, hazard.width - 14, 8);
    return;
  }

  if (hazard.kind === "barrier") {
    const x = hazard.x;
    const y = GROUND_Y - hazard.height;
    roundedRect(ctx, x + 8, y, hazard.width - 16, hazard.height * 0.62, 5, "#e8a83e");
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x + 8, y, hazard.width - 16, hazard.height * 0.62, 5);
    ctx.clip();
    ctx.fillStyle = "#f8e9bd";
    for (let stripe = -hazard.height; stripe < hazard.width; stripe += 29) {
      ctx.beginPath();
      ctx.moveTo(x + stripe, y);
      ctx.lineTo(x + stripe + 12, y);
      ctx.lineTo(x + stripe - 4, y + hazard.height * 0.62);
      ctx.lineTo(x + stripe - 16, y + hazard.height * 0.62);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = "#455b55";
    ctx.fillRect(x + 18, y + hazard.height * 0.62, 9, GROUND_Y - y - hazard.height * 0.62);
    ctx.fillRect(x + hazard.width - 27, y + hazard.height * 0.62, 9, GROUND_Y - y - hazard.height * 0.62);
    ctx.fillStyle = "#596e66";
    ctx.fillRect(x + 8, GROUND_Y - 5, 32, 6);
    ctx.fillRect(x + hazard.width - 40, GROUND_Y - 5, 32, 6);
    return;
  }

  if (hazard.kind === "bin") {
    const x = hazard.x;
    const y = GROUND_Y - hazard.height;
    roundedRect(ctx, x + 5, y + 8, hazard.width - 10, hazard.height - 8, 7, "#497f77");
    roundedRect(ctx, x, y, hazard.width, 12, 5, "#345f59");
    ctx.fillStyle = "#c4ddd6";
    ctx.fillRect(x + 12, y + 25, hazard.width - 24, 4);
    ctx.fillRect(x + 12, y + 36, hazard.width - 24, 4);
    ctx.fillStyle = "#293c39";
    ctx.beginPath();
    ctx.arc(x + 14, GROUND_Y - 1, 5, 0, Math.PI * 2);
    ctx.arc(x + hazard.width - 14, GROUND_Y - 1, 5, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (hazard.kind === "puddle") {
    ctx.fillStyle = "#379eaa";
    ctx.beginPath();
    ctx.ellipse(hazard.x + hazard.width / 2, GROUND_Y + 2, hazard.width / 2, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#a8e5df";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(hazard.x + hazard.width / 2, GROUND_Y, hazard.width / 3, 4, 0, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  ctx.strokeStyle = "#273638";
    ctx.lineWidth = 13;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(hazard.x, GROUND_Y + 1);
  ctx.bezierCurveTo(hazard.x + 18, GROUND_Y - 17, hazard.x + hazard.width - 15, GROUND_Y + 15, hazard.x + hazard.width, GROUND_Y - 1);
  ctx.stroke();
  ctx.strokeStyle = "#e6a34b";
    ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(hazard.x + hazard.width * 0.35, GROUND_Y - 7);
  ctx.lineTo(hazard.x + hazard.width * 0.35, GROUND_Y + 3);
  ctx.stroke();
}

function drawTool(ctx, tool) {
  ctx.save();
  ctx.translate(tool.x, tool.y + Math.sin(tool.bob) * 4);
  ctx.rotate(Math.sin(tool.bob) * 0.12);
  ctx.strokeStyle = "#d59627";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-9, 9);
  ctx.lineTo(8, -8);
  ctx.stroke();
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(10, -10, 7, -0.9, 2.1);
  ctx.stroke();
  ctx.restore();
}

export default function RunnerCanvas({ gameRef, gameStatus, onScore, onGameOver, onJump }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !ctx) return undefined;

    let frameId;
    let lastTime = 0;
    let lastHudUpdate = 0;
    let drawingWidth = 0;
    let drawingHeight = 0;

    const draw = (timestamp) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const nextWidth = Math.max(1, Math.round(rect.width * dpr));
      const nextHeight = Math.max(1, Math.round(rect.height * dpr));
      if (nextWidth !== drawingWidth || nextHeight !== drawingHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
        drawingWidth = nextWidth;
        drawingHeight = nextHeight;
      }
      ctx.setTransform(drawingWidth / SCENE_WIDTH, 0, 0, drawingHeight / SCENE_HEIGHT, 0, 0);

      const game = gameRef.current;
      const dt = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.035) : 0;
      lastTime = timestamp;

      if (game.status === "running") {
        game.elapsed += dt;
        game.speed = Math.min(760, 330 + game.elapsed * 11);
        game.distance += game.speed * dt;
        game.runnerVelocity += 1900 * dt;
        game.runnerBottom += game.runnerVelocity * dt;
        if (game.runnerBottom >= GROUND_Y) {
          game.runnerBottom = GROUND_Y;
          game.runnerVelocity = 0;
        }

        game.hazardTimer -= dt;
        if (game.hazardTimer <= 0) {
          const roll = Math.random();
          const kind = roll < 0.28 ? "toolbox" : roll < 0.52 ? "barrier" : roll < 0.76 ? "bin" : roll < 0.9 ? "puddle" : "cable";
          const dimensions = {
            toolbox: { width: 56 + Math.random() * 12, height: 48 + Math.random() * 9 },
            barrier: { width: 90 + Math.random() * 18, height: 50 + Math.random() * 9 },
            bin: { width: 50 + Math.random() * 8, height: 58 + Math.random() * 10 },
            puddle: { width: 82 + Math.random() * 18, height: 0 },
            cable: { width: 76 + Math.random() * 12, height: 0 },
          }[kind];
          game.hazards.push({ kind, x: SCENE_WIDTH + 30, ...dimensions });
          // Shorten the reaction window gradually, with a floor that remains jumpable.
          const spacing = Math.max(1.12, 1.72 - game.elapsed * 0.009);
          game.hazardTimer = spacing + Math.random() * 0.38;
        }

        game.toolTimer -= dt;
        if (game.toolTimer <= 0) {
          game.tools.push({ x: SCENE_WIDTH + 15, y: GROUND_Y - 72 - Math.random() * 32, bob: Math.random() * 6 });
          game.toolTimer = 2.7 + Math.random() * 1.8;
        }

        game.hazards.forEach((hazard) => { hazard.x -= game.speed * dt; });
        game.tools.forEach((tool) => {
          tool.x -= game.speed * dt;
          tool.bob += dt * 4;
        });
        game.hazards = game.hazards.filter((hazard) => hazard.x + hazard.width > -10);
        game.tools = game.tools.filter((tool) => tool.x > -20);
        game.tools = game.tools.filter((tool) => {
          const collected = Math.abs(tool.x - RUNNER_X) < 25 && Math.abs(tool.y - (game.runnerBottom - 38)) < 43;
          if (collected) game.collected += 1;
          return !collected;
        });
        game.score = Math.floor(game.distance / 12) + game.collected * 75;

        const player = {
          left: RUNNER_X - 18,
          right: RUNNER_X + 19,
          top: game.runnerBottom - 55,
          bottom: game.runnerBottom,
        };
        const collision = game.hazards.some((hazard) =>
          player.right > hazard.x + 5 &&
          player.left < hazard.x + hazard.width - 5 &&
          player.bottom > GROUND_Y - 5 &&
          player.top < GROUND_Y + 8 &&
          (hazard.height === 0 || player.bottom > GROUND_Y - hazard.height + 8),
        );

        if (collision) {
          game.status = "over";
          game.best = Math.max(game.best, game.score);
          try {
            localStorage.setItem("fixflow-campus-dash-best", String(game.best));
          } catch {
            // The game remains playable if browser storage is unavailable.
          }
          onGameOver(game.score, game.best);
        } else {
          if (timestamp - lastHudUpdate > 100) {
            lastHudUpdate = timestamp;
            onScore(game.score, game.best);
          }
        }
      }

      drawCampus(ctx, game.distance);
      game.hazards.forEach((hazard) => drawHazard(ctx, hazard));
      game.tools.forEach((tool) => drawTool(ctx, tool));
      drawRunner(ctx, game.runnerBottom, timestamp, game.status === "running");
      if (game.status === "running") frameId = window.requestAnimationFrame(draw);
    };

    frameId = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frameId);
  }, [gameRef, gameStatus, onGameOver, onScore]);

  return (
    <canvas
      ref={canvasRef}
      className="campus-dash-canvas block w-full touch-none"
      width={SCENE_WIDTH}
      height={SCENE_HEIGHT}
      onPointerDown={onJump}
      role="img"
      aria-label="Campus Dash game scene. Jump over puddles and cables, and collect wrench tools."
    />
  );
}
