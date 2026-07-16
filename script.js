const navToggle = document.querySelector('.nav-toggle');
const siteNav = document.querySelector('.site-nav');
const navLinks = siteNav ? siteNav.querySelectorAll('a') : [];

if (navToggle && siteNav) {
  navToggle.addEventListener('click', () => {
    const isOpen = siteNav.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      siteNav.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const DIRECTION_LIST = [DIRECTIONS.up, DIRECTIONS.down, DIRECTIONS.left, DIRECTIONS.right];
const gameControllers = {};
let activeGame = 'snake';

function setActiveGame(name) {
  activeGame = name;
}

function sameCell(a, b) {
  return a.x === b.x && a.y === b.y;
}

function isOpposite(next, current) {
  return (
    (next.x === 1 && current.x === -1) ||
    (next.x === -1 && current.x === 1) ||
    (next.y === 1 && current.y === -1) ||
    (next.y === -1 && current.y === 1)
  );
}

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function cloneDirection(direction) {
  return { x: direction.x, y: direction.y };
}

function randomDirection(exclude) {
  const options = exclude
    ? DIRECTION_LIST.filter((direction) => !isOpposite(direction, exclude))
    : DIRECTION_LIST.slice();
  return cloneDirection(options[randomInt(options.length)]);
}

function randomCell(gridSize, occupied = []) {
  let cell = {
    x: randomInt(gridSize),
    y: randomInt(gridSize),
  };

  let attempts = 0;
  while (occupied.some((item) => sameCell(item, cell)) && attempts < gridSize * gridSize) {
    cell = {
      x: randomInt(gridSize),
      y: randomInt(gridSize),
    };
    attempts += 1;
  }

  return cell;
}

function moveCell(cell, direction, gridSize, wrap = false) {
  const next = {
    x: cell.x + direction.x,
    y: cell.y + direction.y,
  };

  if (wrap) {
    return {
      x: (next.x + gridSize) % gridSize,
      y: (next.y + gridSize) % gridSize,
    };
  }

  return next;
}

function cellToPoint(cell, cellSize) {
  return {
    x: cell.x * cellSize + cellSize / 2,
    y: cell.y * cellSize + cellSize / 2,
  };
}

function drawRoundedCell(ctx, cell, cellSize, fillStyle, radiusScale = 0.34) {
  const size = cellSize - 2;
  const x = cell.x * cellSize + 1;
  const y = cell.y * cellSize + 1;
  const radius = Math.max(4, size * radiusScale);

  ctx.fillStyle = fillStyle;

  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, radius);
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + size - radius, y);
  ctx.quadraticCurveTo(x + size, y, x + size, y + radius);
  ctx.lineTo(x + size, y + size - radius);
  ctx.quadraticCurveTo(x + size, y + size, x + size - radius, y + size);
  ctx.lineTo(x + radius, y + size);
  ctx.quadraticCurveTo(x, y + size, x, y + size - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.fill();
}

function drawCircle(ctx, x, y, radius, fillStyle, shadowColor = fillStyle, blur = 0) {
  ctx.save();
  ctx.fillStyle = fillStyle;
  ctx.shadowColor = shadowColor;
  ctx.shadowBlur = blur;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDiamond(ctx, x, y, size, fillStyle, shadowColor = fillStyle, blur = 0) {
  ctx.save();
  ctx.fillStyle = fillStyle;
  ctx.shadowColor = shadowColor;
  ctx.shadowBlur = blur;
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function bindDirectionButtons(buttons, gameName, handler) {
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      setActiveGame(gameName);
      handler(button.dataset.dir || button.dataset.agarDir || button.dataset.orbitDir);
    });
  });
}

const snakeCanvas = document.getElementById('snake-canvas');
const snakeScore = document.getElementById('snake-score');
const snakeHighScore = document.getElementById('snake-high-score');
const snakeStatus = document.getElementById('snake-status');
const snakeToggle = document.getElementById('snake-toggle');
const snakeRestart = document.getElementById('snake-restart');
const snakeTouchButtons = document.querySelectorAll('.touch-pad button[data-dir]');

if (snakeCanvas && snakeScore && snakeHighScore && snakeStatus && snakeToggle && snakeRestart) {
  const ctx = snakeCanvas.getContext('2d');
  const gridSize = 24;
  const cellSize = snakeCanvas.width / gridSize;
  const speedMs = 120;
  const storageKey = 'nullablenull-snake-high-score';

  let snake;
  let direction;
  let pendingDirection;
  let food;
  let score;
  let highScore;
  let timerId;
  let started;
  let gameOver;
  let enemies;
  let burstActive;
  let burstEndsAt;
  let burstAnchors;
  let lastBurstAt;

  function spawnFood(occupied = []) {
    return randomCell(gridSize, occupied);
  }

  function spawnEnemies() {
    const occupied = [...snake, food];
    enemies = [];

    while (enemies.length < 4) {
      const cell = randomCell(gridSize, occupied.concat(enemies));
      enemies.push({
        x: cell.x,
        y: cell.y,
        dir: randomDirection(),
        turnAt: performance.now() + 500 + randomInt(800),
      });
    }
  }

  function readHighScore() {
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = Number.parseInt(raw || '0', 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      return 0;
    }
  }

  function writeHighScore(value) {
    highScore = Math.max(highScore, value);
    snakeHighScore.textContent = String(highScore);

    try {
      window.localStorage.setItem(storageKey, String(highScore));
    } catch {
      // localStorage may be unavailable in restricted contexts.
    }
  }

  function setStatus(value) {
    snakeStatus.textContent = value;
  }

  function resetGame() {
    snake = [
      { x: 10, y: 12 },
      { x: 9, y: 12 },
      { x: 8, y: 12 },
    ];
    direction = cloneDirection(DIRECTIONS.right);
    pendingDirection = cloneDirection(DIRECTIONS.right);
    score = 0;
    started = false;
    gameOver = false;
    burstActive = false;
    burstEndsAt = 0;
    burstAnchors = [];
    lastBurstAt = performance.now();
    snakeToggle.textContent = 'Start';
    food = spawnFood([...snake]);
    snakeScore.textContent = String(score);
    snakeStatus.textContent = 'Ready';
    snakeHighScore.textContent = String(highScore);
    spawnEnemies();
    draw();
  }

  function setDirection(next) {
    if (!next || isOpposite(next, direction)) {
      return;
    }

    pendingDirection = cloneDirection(next);

    if (!started && !gameOver) {
      startGame();
    }
  }

  function updateEnemies(now) {
    if (!burstActive && now - lastBurstAt >= 4000) {
      burstActive = true;
      burstEndsAt = now + 280;
      burstAnchors = enemies.map((enemy) => ({ x: enemy.x, y: enemy.y }));
      return;
    }

    if (burstActive) {
      if (now >= burstEndsAt) {
        burstActive = false;
        lastBurstAt = now;
        spawnEnemies();
      }

      return;
    }

    enemies.forEach((enemy) => {
      if (now >= enemy.turnAt || Math.random() < 0.12) {
        enemy.dir = randomDirection(enemy.dir);
        enemy.turnAt = now + 500 + randomInt(900);
      }

      const next = moveCell(enemy, enemy.dir, gridSize, true);
      enemy.x = next.x;
      enemy.y = next.y;
    });
  }

  function move() {
    if (gameOver) {
      return;
    }

    direction = cloneDirection(pendingDirection);
    const head = snake[0];
    const nextHead = {
      x: head.x + direction.x,
      y: head.y + direction.y,
    };

    const willEat = sameCell(nextHead, food);
    const bodyToCheck = willEat ? snake : snake.slice(0, -1);

    const hitWall =
      nextHead.x < 0 ||
      nextHead.x >= gridSize ||
      nextHead.y < 0 ||
      nextHead.y >= gridSize;

    const hitSelf = bodyToCheck.some((segment) => sameCell(segment, nextHead));

    if (hitWall || hitSelf) {
      gameOver = true;
      stopLoop();
      snakeToggle.textContent = 'Start';
      setStatus('Game Over');
      draw();
      return;
    }

    snake.unshift(nextHead);

    if (willEat) {
      score += 1;
      snakeScore.textContent = String(score);
      writeHighScore(score);
      food = spawnFood([...snake, ...enemies]);
    } else {
      snake.pop();
    }

    updateEnemies(performance.now());

    if (burstActive) {
      draw();
      return;
    }

    if (enemies.some((enemy) => sameCell(enemy, snake[0]))) {
      gameOver = true;
      stopLoop();
      snakeToggle.textContent = 'Start';
      setStatus('Game Over');
      draw();
      return;
    }

    draw();
  }

  function drawBackground() {
    ctx.clearRect(0, 0, snakeCanvas.width, snakeCanvas.height);
    ctx.fillStyle = '#081426';
    ctx.fillRect(0, 0, snakeCanvas.width, snakeCanvas.height);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, snakeCanvas.width - 2, snakeCanvas.height - 2);
    ctx.strokeStyle = 'rgba(45, 117, 255, 0.12)';
    ctx.beginPath();
    ctx.arc(snakeCanvas.width / 2, snakeCanvas.height / 2, snakeCanvas.width * 0.32, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawFood() {
    const point = cellToPoint(food, cellSize);
    drawCircle(ctx, point.x, point.y, cellSize * 0.28, '#e33a3f', '#e33a3f', 18);
  }

  function drawSnakeSegments() {
    snake.forEach((segment, index) => {
      const fillStyle = index === 0 ? '#ffffff' : index % 2 === 0 ? '#2d75ff' : '#c9d8ff';
      ctx.save();
      ctx.shadowBlur = index === 0 ? 14 : 10;
      ctx.shadowColor = index === 0 ? '#2d75ff' : '#e33a3f';
      drawRoundedCell(ctx, segment, cellSize, fillStyle, 0.34);
      ctx.restore();
    });
  }

  function drawExplosion(anchor, index) {
    const point = cellToPoint(anchor, cellSize);
    const base = 14 + (index % 3) * 2;
    drawCircle(ctx, point.x, point.y, base + 8, 'rgba(227, 58, 63, 0.18)', '#e33a3f', 14);
    drawCircle(ctx, point.x, point.y, base, 'rgba(255, 255, 255, 0.24)', '#ffffff', 8);
  }

  function drawEnemies() {
    if (burstActive) {
      burstAnchors.forEach((anchor, index) => drawExplosion(anchor, index));
      return;
    }

    enemies.forEach((enemy, index) => {
      const point = cellToPoint(enemy, cellSize);
      const fillStyle = index % 2 === 0 ? '#e33a3f' : '#2d75ff';
      drawCircle(ctx, point.x, point.y, cellSize * 0.23, fillStyle, fillStyle, 14);
      drawCircle(ctx, point.x, point.y, cellSize * 0.1, '#ffffff', '#ffffff', 0);
    });
  }

  function drawGameOver() {
    if (!gameOver) {
      return;
    }

    ctx.fillStyle = 'rgba(5, 13, 28, 0.72)';
    ctx.fillRect(0, 0, snakeCanvas.width, snakeCanvas.height);
    ctx.fillStyle = '#eaf6ef';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', snakeCanvas.width / 2, snakeCanvas.height / 2 - 8);
    ctx.font = '16px sans-serif';
    ctx.fillText('Restart to play again', snakeCanvas.width / 2, snakeCanvas.height / 2 + 26);
  }

  function draw() {
    drawBackground();
    drawFood();
    drawEnemies();
    drawSnakeSegments();
    drawGameOver();
  }

  function startLoop() {
    if (timerId) {
      return;
    }

    timerId = window.setInterval(move, speedMs);
  }

  function stopLoop() {
    if (!timerId) {
      return;
    }

    window.clearInterval(timerId);
    timerId = null;
  }

  function startGame() {
    if (gameOver) {
      return;
    }

    started = true;
    setStatus('Playing');
    snakeToggle.textContent = 'Pause';
    startLoop();
  }

  function pauseGame() {
    if (!started || gameOver) {
      return;
    }

    started = false;
    stopLoop();
    setStatus('Paused');
    snakeToggle.textContent = 'Resume';
  }

  function toggleGame() {
    setActiveGame('snake');

    if (gameOver) {
      resetGame();
      startGame();
      return;
    }

    if (!started) {
      startGame();
    } else {
      pauseGame();
    }
  }

  function restartGame() {
    setActiveGame('snake');
    stopLoop();
    resetGame();
  }

  snakeCanvas.addEventListener('pointerdown', () => setActiveGame('snake'));
  snakeRestart.addEventListener('click', restartGame);
  snakeToggle.addEventListener('click', toggleGame);
  bindDirectionButtons(snakeTouchButtons, 'snake', (dirName) => {
    setDirection(DIRECTIONS[dirName]);
  });

  highScore = readHighScore();
  snakeHighScore.textContent = String(highScore);
  resetGame();

  gameControllers.snake = {
    setDirection,
    toggleGame,
    restartGame,
  };
}

const agarCanvas = document.getElementById('agar-canvas');
const agarScore = document.getElementById('agar-score');
const agarHighScore = document.getElementById('agar-high-score');
const agarStatus = document.getElementById('agar-status');
const agarToggle = document.getElementById('agar-toggle');
const agarRestart = document.getElementById('agar-restart');
const agarTouchButtons = document.querySelectorAll('.touch-pad button[data-agar-dir]');

if (agarCanvas && agarScore && agarHighScore && agarStatus && agarToggle && agarRestart) {
  const ctx = agarCanvas.getContext('2d');
  const gridSize = 18;
  const cellSize = agarCanvas.width / gridSize;
  const speedMs = 130;
  const storageKey = 'nullablenull-agar-high-score';

  let player;
  let direction;
  let pendingDirection;
  let pellets;
  let rivals;
  let score;
  let highScore;
  let timerId;
  let started;
  let gameOver;

  function occupiedCells() {
    return [player, ...pellets, ...rivals];
  }

  function spawnPellet(existing = []) {
    return randomCell(gridSize, existing);
  }

  function spawnPellets(count) {
    const cells = [];
    while (cells.length < count) {
      const pellet = spawnPellet([...occupiedCells(), ...cells]);
      cells.push(pellet);
    }
    return cells;
  }

  function spawnRival(existing = []) {
    const cell = randomCell(gridSize, existing);
    return {
      x: cell.x,
      y: cell.y,
      mass: 1 + randomInt(4),
      dir: randomDirection(),
      turnAt: performance.now() + 300 + randomInt(700),
    };
  }

  function spawnRivals(count) {
    const list = [];
    while (list.length < count) {
      const rival = spawnRival([...occupiedCells(), ...list]);
      list.push(rival);
    }
    return list;
  }

  function readHighScore() {
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = Number.parseInt(raw || '0', 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      return 0;
    }
  }

  function writeHighScore(value) {
    highScore = Math.max(highScore, value);
    agarHighScore.textContent = String(highScore);

    try {
      window.localStorage.setItem(storageKey, String(highScore));
    } catch {
      // localStorage may be unavailable in restricted contexts.
    }
  }

  function setStatus(value) {
    agarStatus.textContent = value;
  }

  function resetGame() {
    player = { x: 9, y: 9, mass: 3 };
    direction = cloneDirection(DIRECTIONS.right);
    pendingDirection = cloneDirection(DIRECTIONS.right);
    score = 0;
    started = false;
    gameOver = false;
    agarToggle.textContent = 'Start';
    pellets = [];
    rivals = [];
    pellets = spawnPellets(18);
    rivals = spawnRivals(4);
    agarScore.textContent = String(score);
    agarStatus.textContent = 'Ready';
    agarHighScore.textContent = String(highScore);
    draw();
  }

  function setDirection(next) {
    if (!next || isOpposite(next, direction)) {
      return;
    }

    pendingDirection = cloneDirection(next);

    if (!started && !gameOver) {
      startGame();
    }
  }

  function stepRivals(now) {
    rivals.forEach((rival) => {
      if (now >= rival.turnAt || Math.random() < 0.18) {
        rival.dir = randomDirection(rival.dir);
        rival.turnAt = now + 260 + randomInt(700);
      }

      const next = moveCell(rival, rival.dir, gridSize, true);
      rival.x = next.x;
      rival.y = next.y;
    });
  }

  function move() {
    if (gameOver) {
      return;
    }

    direction = cloneDirection(pendingDirection);
    player = moveCell(player, direction, gridSize, true);

    const pelletIndex = pellets.findIndex((pellet) => sameCell(pellet, player));
    if (pelletIndex !== -1) {
      pellets.splice(pelletIndex, 1);
      pellets.push(spawnPellet(occupiedCells()));
      score += 1;
      player.mass += 1;
      agarScore.textContent = String(score);
      writeHighScore(score);
    }

    stepRivals(performance.now());

    for (let index = 0; index < rivals.length; index += 1) {
      const rival = rivals[index];
      if (!sameCell(rival, player)) {
        continue;
      }

      if (player.mass >= rival.mass) {
        score += rival.mass * 2;
        player.mass += rival.mass;
        agarScore.textContent = String(score);
        writeHighScore(score);
        rivals[index] = spawnRival(occupiedCells().filter((cell) => cell !== rival));
      } else {
        gameOver = true;
        stopLoop();
        agarToggle.textContent = 'Start';
        setStatus('Game Over');
        draw();
        return;
      }
    }

    draw();
  }

  function drawBackground() {
    ctx.clearRect(0, 0, agarCanvas.width, agarCanvas.height);
    ctx.fillStyle = '#071325';
    ctx.fillRect(0, 0, agarCanvas.width, agarCanvas.height);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    for (let i = 0; i <= gridSize; i += 1) {
      const position = i * cellSize;
      ctx.beginPath();
      ctx.moveTo(position, 0);
      ctx.lineTo(position, agarCanvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, position);
      ctx.lineTo(agarCanvas.width, position);
      ctx.stroke();
    }
  }

  function drawPellets() {
    pellets.forEach((pellet) => {
      const point = cellToPoint(pellet, cellSize);
      drawCircle(ctx, point.x, point.y, cellSize * 0.13, '#c9d8ff', '#ffffff', 6);
    });
  }

  function drawPlayer() {
    const point = cellToPoint(player, cellSize);
    const radius = Math.min(cellSize * 0.5, 8 + player.mass * 1.7);
    drawCircle(ctx, point.x, point.y, radius, '#2d75ff', '#2d75ff', 18);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(player.mass), point.x, point.y + 4);
  }

  function drawRivals() {
    rivals.forEach((rival) => {
      const point = cellToPoint(rival, cellSize);
      const radius = Math.min(cellSize * 0.48, 7 + rival.mass * 1.6);
      drawCircle(ctx, point.x, point.y, radius, '#e33a3f', '#e33a3f', 14);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(rival.mass), point.x, point.y + 4);
    });
  }

  function drawGameOver() {
    if (!gameOver) {
      return;
    }

    ctx.fillStyle = 'rgba(5, 13, 28, 0.66)';
    ctx.fillRect(0, 0, agarCanvas.width, agarCanvas.height);
    ctx.fillStyle = '#eaf6ef';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', agarCanvas.width / 2, agarCanvas.height / 2 - 6);
    ctx.font = '16px sans-serif';
    ctx.fillText('Restart to play again', agarCanvas.width / 2, agarCanvas.height / 2 + 24);
  }

  function draw() {
    drawBackground();
    drawPellets();
    drawRivals();
    drawPlayer();
    drawGameOver();
  }

  function startLoop() {
    if (timerId) {
      return;
    }

    timerId = window.setInterval(move, speedMs);
  }

  function stopLoop() {
    if (!timerId) {
      return;
    }

    window.clearInterval(timerId);
    timerId = null;
  }

  function startGame() {
    if (gameOver) {
      return;
    }

    started = true;
    setStatus('Playing');
    agarToggle.textContent = 'Pause';
    startLoop();
  }

  function pauseGame() {
    if (!started || gameOver) {
      return;
    }

    started = false;
    stopLoop();
    setStatus('Paused');
    agarToggle.textContent = 'Resume';
  }

  function toggleGame() {
    setActiveGame('agar');

    if (gameOver) {
      resetGame();
      startGame();
      return;
    }

    if (!started) {
      startGame();
    } else {
      pauseGame();
    }
  }

  function restartGame() {
    setActiveGame('agar');
    stopLoop();
    resetGame();
  }

  agarCanvas.addEventListener('pointerdown', () => setActiveGame('agar'));
  agarRestart.addEventListener('click', restartGame);
  agarToggle.addEventListener('click', toggleGame);
  bindDirectionButtons(agarTouchButtons, 'agar', (dirName) => {
    setDirection(DIRECTIONS[dirName]);
  });

  highScore = readHighScore();
  agarHighScore.textContent = String(highScore);
  resetGame();

  gameControllers.agar = {
    setDirection,
    toggleGame,
    restartGame,
  };
}

const orbitCanvas = document.getElementById('orbit-canvas');
const orbitScore = document.getElementById('orbit-score');
const orbitHighScore = document.getElementById('orbit-high-score');
const orbitStatus = document.getElementById('orbit-status');
const orbitToggle = document.getElementById('orbit-toggle');
const orbitRestart = document.getElementById('orbit-restart');
const orbitTouchButtons = document.querySelectorAll('.touch-pad button[data-orbit-dir]');

if (orbitCanvas && orbitScore && orbitHighScore && orbitStatus && orbitToggle && orbitRestart) {
  const ctx = orbitCanvas.getContext('2d');
  const gridSize = 18;
  const cellSize = orbitCanvas.width / gridSize;
  const speedMs = 120;
  const storageKey = 'nullablenull-orbit-high-score';

  let player;
  let direction;
  let pendingDirection;
  let stars;
  let comets;
  let score;
  let highScore;
  let timerId;
  let started;
  let gameOver;

  function occupiedCells() {
    return [player, ...stars, ...comets];
  }

  function spawnStar(existing = []) {
    return randomCell(gridSize, existing);
  }

  function spawnStars(count) {
    const list = [];
    while (list.length < count) {
      list.push(spawnStar([...occupiedCells(), ...list]));
    }
    return list;
  }

  function spawnComet(existing = []) {
    const cell = randomCell(gridSize, existing);
    return {
      x: cell.x,
      y: cell.y,
      dir: randomDirection(),
      turnAt: performance.now() + 320 + randomInt(700),
    };
  }

  function spawnComets(count) {
    const list = [];
    while (list.length < count) {
      list.push(spawnComet([...occupiedCells(), ...list]));
    }
    return list;
  }

  function readHighScore() {
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = Number.parseInt(raw || '0', 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      return 0;
    }
  }

  function writeHighScore(value) {
    highScore = Math.max(highScore, value);
    orbitHighScore.textContent = String(highScore);

    try {
      window.localStorage.setItem(storageKey, String(highScore));
    } catch {
      // localStorage may be unavailable in restricted contexts.
    }
  }

  function setStatus(value) {
    orbitStatus.textContent = value;
  }

  function resetGame() {
    player = { x: 9, y: 9 };
    direction = cloneDirection(DIRECTIONS.right);
    pendingDirection = cloneDirection(DIRECTIONS.right);
    score = 0;
    started = false;
    gameOver = false;
    orbitToggle.textContent = 'Start';
    stars = [];
    comets = [];
    stars = spawnStars(12);
    comets = spawnComets(4);
    orbitScore.textContent = String(score);
    orbitStatus.textContent = 'Ready';
    orbitHighScore.textContent = String(highScore);
    draw();
  }

  function setDirection(next) {
    if (!next || isOpposite(next, direction)) {
      return;
    }

    pendingDirection = cloneDirection(next);

    if (!started && !gameOver) {
      startGame();
    }
  }

  function stepComets(now) {
    comets.forEach((comet) => {
      if (now >= comet.turnAt || Math.random() < 0.2) {
        comet.dir = randomDirection(comet.dir);
        comet.turnAt = now + 260 + randomInt(700);
      }

      const next = moveCell(comet, comet.dir, gridSize, true);
      comet.x = next.x;
      comet.y = next.y;
    });
  }

  function move() {
    if (gameOver) {
      return;
    }

    direction = cloneDirection(pendingDirection);
    player = moveCell(player, direction, gridSize, true);

    const starIndex = stars.findIndex((star) => sameCell(star, player));
    if (starIndex !== -1) {
      stars.splice(starIndex, 1);
      stars.push(spawnStar(occupiedCells()));
      score += 1;
      orbitScore.textContent = String(score);
      writeHighScore(score);
    }

    stepComets(performance.now());

    if (comets.some((comet) => sameCell(comet, player))) {
      gameOver = true;
      stopLoop();
      orbitToggle.textContent = 'Start';
      setStatus('Game Over');
      draw();
      return;
    }

    draw();
  }

  function drawBackground() {
    ctx.clearRect(0, 0, orbitCanvas.width, orbitCanvas.height);
    ctx.fillStyle = '#071325';
    ctx.fillRect(0, 0, orbitCanvas.width, orbitCanvas.height);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    for (let i = 0; i <= gridSize; i += 1) {
      const position = i * cellSize;
      ctx.beginPath();
      ctx.moveTo(position, 0);
      ctx.lineTo(position, orbitCanvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, position);
      ctx.lineTo(orbitCanvas.width, position);
      ctx.stroke();
    }
  }

  function drawStars() {
    stars.forEach((star) => {
      const point = cellToPoint(star, cellSize);
      drawDiamond(ctx, point.x, point.y, cellSize * 0.16, '#c9d8ff', '#ffffff', 8);
    });
  }

  function drawPlayer() {
    const point = cellToPoint(player, cellSize);
    ctx.save();
    ctx.shadowColor = '#2d75ff';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#2d75ff';
    ctx.beginPath();
    ctx.arc(point.x, point.y, cellSize * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawCircle(ctx, point.x, point.y, cellSize * 0.11, '#ffffff', '#ffffff', 0);
  }

  function drawComets() {
    comets.forEach((comet) => {
      const point = cellToPoint(comet, cellSize);
      drawCircle(ctx, point.x, point.y, cellSize * 0.24, '#e33a3f', '#e33a3f', 14);
      drawCircle(ctx, point.x + 6, point.y - 6, cellSize * 0.08, '#ffffff', '#ffffff', 0);
    });
  }

  function drawGameOver() {
    if (!gameOver) {
      return;
    }

    ctx.fillStyle = 'rgba(5, 13, 28, 0.66)';
    ctx.fillRect(0, 0, orbitCanvas.width, orbitCanvas.height);
    ctx.fillStyle = '#eaf6ef';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', orbitCanvas.width / 2, orbitCanvas.height / 2 - 6);
    ctx.font = '16px sans-serif';
    ctx.fillText('Restart to play again', orbitCanvas.width / 2, orbitCanvas.height / 2 + 24);
  }

  function draw() {
    drawBackground();
    drawStars();
    drawComets();
    drawPlayer();
    drawGameOver();
  }

  function startLoop() {
    if (timerId) {
      return;
    }

    timerId = window.setInterval(move, speedMs);
  }

  function stopLoop() {
    if (!timerId) {
      return;
    }

    window.clearInterval(timerId);
    timerId = null;
  }

  function startGame() {
    if (gameOver) {
      return;
    }

    started = true;
    setStatus('Playing');
    orbitToggle.textContent = 'Pause';
    startLoop();
  }

  function pauseGame() {
    if (!started || gameOver) {
      return;
    }

    started = false;
    stopLoop();
    setStatus('Paused');
    orbitToggle.textContent = 'Resume';
  }

  function toggleGame() {
    setActiveGame('orbit');

    if (gameOver) {
      resetGame();
      startGame();
      return;
    }

    if (!started) {
      startGame();
    } else {
      pauseGame();
    }
  }

  function restartGame() {
    setActiveGame('orbit');
    stopLoop();
    resetGame();
  }

  orbitCanvas.addEventListener('pointerdown', () => setActiveGame('orbit'));
  orbitRestart.addEventListener('click', restartGame);
  orbitToggle.addEventListener('click', toggleGame);
  bindDirectionButtons(orbitTouchButtons, 'orbit', (dirName) => {
    setDirection(DIRECTIONS[dirName]);
  });

  highScore = readHighScore();
  orbitHighScore.textContent = String(highScore);
  resetGame();

  gameControllers.orbit = {
    setDirection,
    toggleGame,
    restartGame,
  };
}

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  const controller = gameControllers[activeGame];

  if (!controller) {
    return;
  }

  if (['arrowup', 'w'].includes(key)) {
    event.preventDefault();
    controller.setDirection(DIRECTIONS.up);
  } else if (['arrowdown', 's'].includes(key)) {
    event.preventDefault();
    controller.setDirection(DIRECTIONS.down);
  } else if (['arrowleft', 'a'].includes(key)) {
    event.preventDefault();
    controller.setDirection(DIRECTIONS.left);
  } else if (['arrowright', 'd'].includes(key)) {
    event.preventDefault();
    controller.setDirection(DIRECTIONS.right);
  }
});
