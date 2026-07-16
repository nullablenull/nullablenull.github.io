(() => {
  'use strict';

  const STORAGE_KEYS = {
    snakeHighScore: 'nullablenull-snake-high-score',
    agarHighScore: 'nullablenull-agar-high-score'
  };

  const state = {
    activeGame: 'snake',
    navOpen: false
  };

  document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    setupSnakeGame();
    setupAgarGame();
    setupMudGame();
  });

  function setupNavigation() {
    const navToggle = document.querySelector('.nav-toggle');
    const siteNav = document.querySelector('.site-nav');

    if (!navToggle || !siteNav) {
      return;
    }

    const closeNav = () => {
      state.navOpen = false;
      navToggle.setAttribute('aria-expanded', 'false');
      siteNav.classList.remove('is-open');
    };

    const openNav = () => {
      state.navOpen = true;
      navToggle.setAttribute('aria-expanded', 'true');
      siteNav.classList.add('is-open');
    };

    navToggle.addEventListener('click', () => {
      if (state.navOpen) {
        closeNav();
      } else {
        openNav();
      }
    });

    siteNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 720) {
          closeNav();
        }
      });
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 720 && state.navOpen) {
        closeNav();
      }
    });
  }

  function createGridCanvasContext(canvas) {
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    return context;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function randomInt(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
  }

  function randomChoice(items) {
    return items[randomInt(0, items.length - 1)];
  }

  function sameCell(a, b) {
    return a.x === b.x && a.y === b.y;
  }

  function isOpposite(a, b) {
    return a.x === -b.x && a.y === -b.y;
  }

  function cloneDirection(direction) {
    return { x: direction.x, y: direction.y };
  }

  function randomDirection() {
    return randomChoice([
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 }
    ]);
  }

  function moveCell(cell, direction, amount = 1) {
    return {
      x: cell.x + direction.x * amount,
      y: cell.y + direction.y * amount
    };
  }

  function wrapCell(cell, size) {
    return {
      x: (cell.x + size) % size,
      y: (cell.y + size) % size
    };
  }

  function randomCell(size, avoid = []) {
    for (let index = 0; index < 250; index += 1) {
      const cell = { x: randomInt(0, size - 1), y: randomInt(0, size - 1) };
      if (!avoid.some((entry) => sameCell(entry, cell))) {
        return cell;
      }
    }
    return { x: 0, y: 0 };
  }

  function getStoredNumber(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function setStoredNumber(key, value) {
    try {
      window.localStorage.setItem(key, String(value));
    } catch {
      // Ignore storage failures.
    }
  }

  function routeKeyboard(event, handlers) {
    const target = event.target;
    const typing = target instanceof HTMLElement && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    );

    if (typing) {
      return;
    }

    const key = event.key.toLowerCase();
    if (handlers[key]) {
      event.preventDefault();
      handlers[key]();
    }
  }

  function bindDirectionButtons(selector, onDirection, setActiveGame) {
    document.querySelectorAll(selector).forEach((button) => {
      button.addEventListener('click', () => {
        const directionName = button.dataset.dir || button.dataset.agarDir;
        if (directionName) {
          setActiveGame();
          onDirection(directionName);
        }
      });
    });
  }

  function setupSnakeGame() {
    const canvas = document.getElementById('snake-canvas');
    const context = createGridCanvasContext(canvas);
    const scoreEl = document.getElementById('snake-score');
    const highScoreEl = document.getElementById('snake-high-score');
    const statusEl = document.getElementById('snake-status');
    const toggleButton = document.getElementById('snake-toggle');
    const restartButton = document.getElementById('snake-restart');
    const size = 24;
    const cellSize = canvas.width / size;
    const stepDelay = 120;

    const game = {
      running: false,
      paused: false,
      gameOver: false,
      loopId: null,
      burstId: null,
      burstEndsAt: 0,
      score: 0,
      highScore: getStoredNumber(STORAGE_KEYS.snakeHighScore, 0),
      direction: { x: 1, y: 0 },
      nextDirection: { x: 1, y: 0 },
      snake: [],
      food: { x: 0, y: 0 },
      enemies: [],
      message: 'Ready'
    };

    function updateHud() {
      scoreEl.textContent = String(game.score);
      highScoreEl.textContent = String(game.highScore);
      statusEl.textContent = game.message;
      toggleButton.textContent = game.running ? (game.paused ? 'Resume' : 'Pause') : 'Start';
    }

    function setMessage(message) {
      game.message = message;
      updateHud();
    }

    function syncHighScore() {
      if (game.score > game.highScore) {
        game.highScore = game.score;
        setStoredNumber(STORAGE_KEYS.snakeHighScore, game.highScore);
      }
    }

    function spawnFood() {
      const occupied = [...game.snake, ...game.enemies.map((enemy) => enemy.cell)];
      game.food = randomCell(size, occupied);
    }

    function spawnEnemy(avoid = []) {
      const cell = randomCell(size, [...avoid, ...game.snake, game.food]);
      return {
        cell,
        direction: randomDirection(),
        exploding: false,
        tint: Math.random() > 0.5 ? 'blue' : 'red'
      };
    }

    function respawnEnemies() {
      const avoid = [...game.snake, game.food];
      game.enemies = Array.from({ length: 4 }, () => spawnEnemy(avoid));
    }

    function resetGame() {
      game.running = false;
      game.paused = false;
      game.gameOver = false;
      game.score = 0;
      game.direction = { x: 1, y: 0 };
      game.nextDirection = { x: 1, y: 0 };
      game.snake = [
        { x: 11, y: 12 },
        { x: 10, y: 12 },
        { x: 9, y: 12 }
      ];
      spawnFood();
      respawnEnemies();
      clearInterval(game.loopId);
      clearInterval(game.burstId);
      game.loopId = null;
      game.burstId = null;
      game.burstEndsAt = 0;
      setMessage('Ready');
      updateHud();
      draw();
    }

    function startLoops() {
      if (game.loopId) {
        clearInterval(game.loopId);
      }
      if (game.burstId) {
        clearInterval(game.burstId);
      }

      game.loopId = setInterval(step, stepDelay);
      game.burstId = setInterval(triggerBurst, 4000);
      game.running = true;
      game.paused = false;
      setMessage('Running');
    }

    function startGame() {
      if (game.gameOver) {
        resetGame();
      }

      if (!game.running) {
        startLoops();
      } else if (game.paused) {
        game.paused = false;
        setMessage('Running');
      }
      state.activeGame = 'snake';
      updateHud();
    }

    function pauseGame() {
      if (!game.running || game.gameOver) {
        return;
      }

      game.paused = !game.paused;
      setMessage(game.paused ? 'Paused' : 'Running');
      updateHud();
    }

    function finishGame(reason) {
      game.running = false;
      game.paused = false;
      game.gameOver = true;
      clearInterval(game.loopId);
      clearInterval(game.burstId);
      game.loopId = null;
      game.burstId = null;
      syncHighScore();
      setMessage(`Game over - ${reason}`);
      updateHud();
    }

    function triggerBurst() {
      if (!game.running || game.paused || game.gameOver) {
        return;
      }

      game.enemies.forEach((enemy) => {
        enemy.exploding = true;
      });
      game.burstEndsAt = Date.now() + 650;
      setMessage('Enemy burst');
    }

    function respawnBurstEnemies() {
      const avoid = [...game.snake, game.food];
      game.enemies = game.enemies.map(() => spawnEnemy(avoid));
      game.burstEndsAt = 0;
      if (!game.gameOver) {
        setMessage('Running');
      }
    }

    function updateDirection(name) {
      const directionMap = {
        up: { x: 0, y: -1 },
        down: { x: 0, y: 1 },
        left: { x: -1, y: 0 },
        right: { x: 1, y: 0 }
      };

      const next = directionMap[name];
      if (!next) {
        return;
      }

      if (!isOpposite(next, game.direction)) {
        game.nextDirection = next;
      }
    }

    function moveEnemies() {
      game.enemies = game.enemies.map((enemy) => {
        if (enemy.exploding) {
          return enemy;
        }

        const turnChance = Math.random() < 0.28;
        const direction = turnChance ? randomDirection() : enemy.direction;
        const moved = wrapCell(moveCell(enemy.cell, direction), size);

        return {
          ...enemy,
          cell: moved,
          direction
        };
      });
    }

    function checkEnemyCollision(head) {
      return game.enemies.some((enemy) => !enemy.exploding && sameCell(enemy.cell, head));
    }

    function step() {
      if (!game.running || game.paused || game.gameOver) {
        draw();
        return;
      }

      if (game.nextDirection && !isOpposite(game.nextDirection, game.direction)) {
        game.direction = cloneDirection(game.nextDirection);
      }

      const head = moveCell(game.snake[0], game.direction);

      if (head.x < 0 || head.x >= size || head.y < 0 || head.y >= size) {
        finishGame('hit the edge');
        draw();
        return;
      }

      if (game.snake.some((segment) => sameCell(segment, head))) {
        finishGame('hit itself');
        draw();
        return;
      }

      if (checkEnemyCollision(head)) {
        finishGame('met an enemy');
        draw();
        return;
      }

      game.snake.unshift(head);

      if (sameCell(head, game.food)) {
        game.score += 1;
        syncHighScore();
        spawnFood();
      } else {
        game.snake.pop();
      }

      moveEnemies();

      if (game.burstEndsAt && Date.now() >= game.burstEndsAt) {
        respawnBurstEnemies();
      }

      updateHud();
      draw();
    }

    function drawGrid() {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#08172c';
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.strokeStyle = 'rgba(247, 249, 255, 0.06)';
      context.lineWidth = 1;
      for (let index = 0; index <= size; index += 1) {
        const pos = index * cellSize;
        context.beginPath();
        context.moveTo(pos, 0);
        context.lineTo(pos, canvas.height);
        context.stroke();

        context.beginPath();
        context.moveTo(0, pos);
        context.lineTo(canvas.width, pos);
        context.stroke();
      }
    }

    function drawFood() {
      context.fillStyle = '#e33a3f';
      context.beginPath();
      context.arc(
        game.food.x * cellSize + cellSize / 2,
        game.food.y * cellSize + cellSize / 2,
        cellSize * 0.28,
        0,
        Math.PI * 2
      );
      context.fill();
    }

    function drawEnemies() {
      game.enemies.forEach((enemy, index) => {
        const x = enemy.cell.x * cellSize + cellSize / 2;
        const y = enemy.cell.y * cellSize + cellSize / 2;
        if (enemy.exploding) {
          context.fillStyle = index % 2 === 0 ? 'rgba(45, 117, 255, 0.9)' : 'rgba(227, 58, 63, 0.9)';
          context.beginPath();
          context.arc(x, y, cellSize * 0.38, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = 'rgba(255, 255, 255, 0.85)';
          context.beginPath();
          context.arc(x, y, cellSize * 0.12, 0, Math.PI * 2);
          context.fill();
          return;
        }

        context.fillStyle = enemy.tint === 'blue' ? '#2d75ff' : '#e33a3f';
        context.beginPath();
        context.arc(x, y, cellSize * 0.34, 0, Math.PI * 2);
        context.fill();
      });
    }

    function drawSnake() {
      game.snake.forEach((segment, index) => {
        const x = segment.x * cellSize;
        const y = segment.y * cellSize;
        context.fillStyle = index === 0 ? '#f7f9ff' : '#d6def0';
        context.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4);

        if (index === 0) {
          context.fillStyle = '#17356b';
          context.fillRect(x + 6, y + 6, cellSize - 12, cellSize - 12);
        }
      });
    }

    function drawOverlay() {
      if (game.running && !game.paused && !game.gameOver) {
        return;
      }

      const label = game.gameOver ? 'Game over' : game.paused ? 'Paused' : 'Ready to play';

      context.fillStyle = 'rgba(6, 16, 31, 0.5)';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#f7f9ff';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = '700 22px "Trebuchet MS", sans-serif';
      context.fillText(label, canvas.width / 2, canvas.height / 2 - 12);
      context.font = '500 14px "Trebuchet MS", sans-serif';
      context.fillText('Use arrow keys, WASD, or touch controls', canvas.width / 2, canvas.height / 2 + 18);
    }

    function draw() {
      drawGrid();
      drawFood();
      drawEnemies();
      drawSnake();
      drawOverlay();
    }

    canvas.addEventListener('pointerdown', () => {
      state.activeGame = 'snake';
    });

    toggleButton.addEventListener('click', () => {
      state.activeGame = 'snake';
      if (!game.running || game.paused) {
        startGame();
      } else {
        pauseGame();
      }
    });

    restartButton.addEventListener('click', () => {
      state.activeGame = 'snake';
      resetGame();
      startGame();
    });

    bindDirectionButtons('[data-dir]', (name) => updateDirection(name), () => {
      state.activeGame = 'snake';
      canvas.focus?.();
    });

    document.addEventListener('keydown', (event) => {
      if (state.activeGame !== 'snake') {
        return;
      }

      routeKeyboard(event, {
        arrowup: () => updateDirection('up'),
        w: () => updateDirection('up'),
        arrowdown: () => updateDirection('down'),
        s: () => updateDirection('down'),
        arrowleft: () => updateDirection('left'),
        a: () => updateDirection('left'),
        arrowright: () => updateDirection('right'),
        d: () => updateDirection('right'),
        ' ': () => {
          if (!game.running) {
            startGame();
          } else {
            pauseGame();
          }
        }
      });
    });

    resetGame();
  }

  function setupAgarGame() {
    const canvas = document.getElementById('agar-canvas');
    const context = createGridCanvasContext(canvas);
    const scoreEl = document.getElementById('agar-score');
    const highScoreEl = document.getElementById('agar-high-score');
    const statusEl = document.getElementById('agar-status');
    const toggleButton = document.getElementById('agar-toggle');
    const restartButton = document.getElementById('agar-restart');

    const world = {
      width: 1200,
      height: 1200,
      backgroundGrid: 80
    };

    const game = {
      running: false,
      paused: false,
      gameOver: false,
      loopId: null,
      score: 0,
      highScore: getStoredNumber(STORAGE_KEYS.agarHighScore, 0),
      direction: { x: 0, y: 0 },
      targetDirection: { x: 0, y: 0 },
      player: null,
      pellets: [],
      rivals: [],
      message: 'Ready'
    };

    function updateHud() {
      scoreEl.textContent = String(game.score);
      highScoreEl.textContent = String(game.highScore);
      statusEl.textContent = game.message;
      toggleButton.textContent = game.running ? (game.paused ? 'Resume' : 'Pause') : 'Start';
    }

    function setMessage(message) {
      game.message = message;
      updateHud();
    }

    function syncHighScore() {
      if (game.score > game.highScore) {
        game.highScore = game.score;
        setStoredNumber(STORAGE_KEYS.agarHighScore, game.highScore);
      }
    }

    function createPlayer() {
      return {
        x: world.width / 2,
        y: world.height / 2,
        radius: 20,
        speed: 3.2
      };
    }

    function randomWorldPoint(padding = 20) {
      return {
        x: randomInt(padding, world.width - padding),
        y: randomInt(padding, world.height - padding)
      };
    }

    function spawnPellets() {
      game.pellets = Array.from({ length: 55 }, () => {
        const point = randomWorldPoint(20);
        return { ...point, radius: randomInt(3, 6) };
      });
    }

    function spawnRivals() {
      game.rivals = Array.from({ length: 5 }, (_, index) => {
        const point = randomWorldPoint(40);
        return {
          x: point.x,
          y: point.y,
          radius: index % 2 === 0 ? 26 : 16,
          speed: 1.7 + Math.random() * 0.8,
          direction: randomDirection(),
          name: index % 2 === 0 ? 'Blue rival' : 'Red rival'
        };
      });
    }

    function resetGame() {
      game.running = false;
      game.paused = false;
      game.gameOver = false;
      game.score = 0;
      game.direction = { x: 0, y: 0 };
      game.targetDirection = { x: 0, y: 0 };
      game.player = createPlayer();
      spawnPellets();
      spawnRivals();
      clearInterval(game.loopId);
      game.loopId = null;
      setMessage('Ready');
      updateHud();
      draw();
    }

    function startLoop() {
      if (game.loopId) {
        clearInterval(game.loopId);
      }

      game.loopId = setInterval(step, 33);
      game.running = true;
      game.paused = false;
      setMessage('Running');
    }

    function startGame() {
      if (game.gameOver) {
        resetGame();
      }

      if (!game.running) {
        startLoop();
      } else if (game.paused) {
        game.paused = false;
        setMessage('Running');
      }

      state.activeGame = 'agar';
      updateHud();
    }

    function pauseGame() {
      if (!game.running || game.gameOver) {
        return;
      }

      game.paused = !game.paused;
      setMessage(game.paused ? 'Paused' : 'Running');
      updateHud();
    }

    function finishGame(reason) {
      game.running = false;
      game.paused = false;
      game.gameOver = true;
      clearInterval(game.loopId);
      game.loopId = null;
      syncHighScore();
      setMessage(`Game over - ${reason}`);
      updateHud();
    }

    function setDirection(name) {
      const map = {
        up: { x: 0, y: -1 },
        down: { x: 0, y: 1 },
        left: { x: -1, y: 0 },
        right: { x: 1, y: 0 }
      };

      const direction = map[name];
      if (!direction) {
        return;
      }

      game.targetDirection = direction;
    }

    function movePlayer() {
      if (game.targetDirection.x || game.targetDirection.y) {
        game.direction = cloneDirection(game.targetDirection);
      }

      const nextX = clamp(
        game.player.x + game.direction.x * game.player.speed,
        game.player.radius,
        world.width - game.player.radius
      );
      const nextY = clamp(
        game.player.y + game.direction.y * game.player.speed,
        game.player.radius,
        world.height - game.player.radius
      );

      game.player.x = nextX;
      game.player.y = nextY;
    }

    function moveRivals() {
      game.rivals = game.rivals.map((rival) => {
        const chasing = Math.random() < 0.18;
        const direction = chasing
          ? {
              x: Math.sign(game.player.x - rival.x),
              y: Math.sign(game.player.y - rival.y)
            }
          : (Math.random() < 0.3 ? randomDirection() : rival.direction);

        const moved = {
          x: clamp(rival.x + direction.x * rival.speed, rival.radius, world.width - rival.radius),
          y: clamp(rival.y + direction.y * rival.speed, rival.radius, world.height - rival.radius)
        };

        return {
          ...rival,
          x: moved.x,
          y: moved.y,
          direction
        };
      });
    }

    function consumePellets() {
      game.pellets = game.pellets.filter((pellet) => {
        const dx = pellet.x - game.player.x;
        const dy = pellet.y - game.player.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= game.player.radius + pellet.radius) {
          game.player.radius += 0.22;
          game.score += 1;
          syncHighScore();
          return false;
        }
        return true;
      });

      while (game.pellets.length < 50) {
        const point = randomWorldPoint(20);
        game.pellets.push({ ...point, radius: randomInt(3, 6) });
      }
    }

    function handleRivalCollisions() {
      for (let index = game.rivals.length - 1; index >= 0; index -= 1) {
        const rival = game.rivals[index];
        const distance = Math.hypot(game.player.x - rival.x, game.player.y - rival.y);
        if (distance > game.player.radius + rival.radius - 2) {
          continue;
        }

        if (game.player.radius >= rival.radius * 1.08) {
          game.player.radius += rival.radius * 0.08;
          game.score += 8;
          game.rivals.splice(index, 1);
          syncHighScore();
          const replacement = randomWorldPoint(40);
          game.rivals.push({
            x: replacement.x,
            y: replacement.y,
            radius: rival.radius,
            speed: rival.speed,
            direction: randomDirection(),
            name: rival.name
          });
          setMessage('Enemy absorbed');
          continue;
        }

        finishGame('overtaken by a rival');
        return;
      }
    }

    function step() {
      if (!game.running || game.paused || game.gameOver) {
        draw();
        return;
      }

      movePlayer();
      moveRivals();
      consumePellets();
      handleRivalCollisions();
      syncHighScore();
      updateHud();
      draw();
    }

    function camera() {
      return {
        x: clamp(game.player.x - canvas.width / 2, 0, world.width - canvas.width),
        y: clamp(game.player.y - canvas.height / 2, 0, world.height - canvas.height)
      };
    }

    function drawBackground(view) {
      context.fillStyle = '#09172f';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.strokeStyle = 'rgba(247, 249, 255, 0.06)';
      context.lineWidth = 1;

      for (let x = -view.x % world.backgroundGrid; x < canvas.width; x += world.backgroundGrid) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, canvas.height);
        context.stroke();
      }

      for (let y = -view.y % world.backgroundGrid; y < canvas.height; y += world.backgroundGrid) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(canvas.width, y);
        context.stroke();
      }
    }

    function drawPellets(view) {
      game.pellets.forEach((pellet, index) => {
        context.fillStyle = index % 3 === 0 ? '#f7f9ff' : '#2d75ff';
        context.beginPath();
        context.arc(pellet.x - view.x, pellet.y - view.y, pellet.radius, 0, Math.PI * 2);
        context.fill();
      });
    }

    function drawRivals(view) {
      game.rivals.forEach((rival) => {
        context.fillStyle = rival.radius > game.player.radius ? '#e33a3f' : '#2d75ff';
        context.beginPath();
        context.arc(rival.x - view.x, rival.y - view.y, rival.radius, 0, Math.PI * 2);
        context.fill();
      });
    }

    function drawPlayer(view) {
      context.fillStyle = '#f7f9ff';
      context.beginPath();
      context.arc(game.player.x - view.x, game.player.y - view.y, game.player.radius, 0, Math.PI * 2);
      context.fill();

      context.strokeStyle = 'rgba(7, 14, 28, 0.8)';
      context.lineWidth = 4;
      context.stroke();
    }

    function drawOverlay() {
      if (game.running && !game.paused && !game.gameOver) {
        return;
      }

      const label = game.gameOver ? 'Game over' : game.paused ? 'Paused' : 'Ready to play';

      context.fillStyle = 'rgba(6, 16, 31, 0.5)';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#f7f9ff';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = '700 22px "Trebuchet MS", sans-serif';
      context.fillText(label, canvas.width / 2, canvas.height / 2 - 12);
      context.font = '500 14px "Trebuchet MS", sans-serif';
      context.fillText('Use arrow keys, WASD, or touch controls', canvas.width / 2, canvas.height / 2 + 18);
    }

    function draw() {
      const view = camera();
      drawBackground(view);
      drawPellets(view);
      drawRivals(view);
      drawPlayer(view);
      drawOverlay();
    }

    canvas.addEventListener('pointerdown', () => {
      state.activeGame = 'agar';
    });

    toggleButton.addEventListener('click', () => {
      state.activeGame = 'agar';
      if (!game.running || game.paused) {
        startGame();
      } else {
        pauseGame();
      }
    });

    restartButton.addEventListener('click', () => {
      state.activeGame = 'agar';
      resetGame();
      startGame();
    });

    bindDirectionButtons('[data-agar-dir]', (name) => setDirection(name), () => {
      state.activeGame = 'agar';
    });

    document.addEventListener('keydown', (event) => {
      if (state.activeGame !== 'agar') {
        return;
      }

      routeKeyboard(event, {
        arrowup: () => setDirection('up'),
        w: () => setDirection('up'),
        arrowdown: () => setDirection('down'),
        s: () => setDirection('down'),
        arrowleft: () => setDirection('left'),
        a: () => setDirection('left'),
        arrowright: () => setDirection('right'),
        d: () => setDirection('right'),
        ' ': () => {
          if (!game.running) {
            startGame();
          } else {
            pauseGame();
          }
        }
      });
    });

    resetGame();
  }

  function setupMudGame() {
    const statusEl = document.getElementById('mud-status');
    const logEl = document.getElementById('mud-log');
    const form = document.getElementById('mud-form');
    const input = document.getElementById('mud-command');
    const resetButton = document.getElementById('mud-reset');
    const quickButtons = document.querySelectorAll('[data-mud-command]');

    const rooms = {
      lobby: {
        title: 'Lobby',
        description: 'A tidy lobby with a humming terminal and a glass door to the east that looks locked at first glance.',
        exits: { north: 'gallery' },
        item: null
      },
      gallery: {
        title: 'Gallery',
        description: 'Blue-and-red panels line the wall. A laminated access card rests on a narrow shelf.',
        exits: { south: 'lobby', east: 'archive' },
        item: 'access card'
      },
      archive: {
        title: 'Archive',
        description: 'Shelves of logs and old diagrams surround a sealed door to the east.',
        exits: { west: 'gallery', east: 'server' },
        item: 'route note',
        lockedExit: 'east'
      },
      server: {
        title: 'Server Room',
        description: 'The server room glows softly. Fans spin up, lights turn green, and the network finally comes alive.',
        exits: { west: 'archive' },
        item: null
      }
    };

    const game = {
      currentRoom: 'lobby',
      inventory: [],
      log: [],
      unlockedServer: false,
      won: false
    };

    function render() {
      logEl.innerHTML = '';
      game.log.slice(-20).forEach((line) => {
        const p = document.createElement('p');
        p.className = `mud-line${line.type ? ` is-${line.type}` : ''}`;
        p.textContent = line.text;
        logEl.appendChild(p);
      });
      logEl.scrollTop = logEl.scrollHeight;
      statusEl.textContent = game.won ? 'Complete' : rooms[game.currentRoom].title;
    }

    function say(text, type = 'system') {
      game.log.push({ text, type });
      render();
    }

    function resetGame() {
      game.currentRoom = 'lobby';
      game.inventory = [];
      game.log = [];
      game.unlockedServer = false;
      game.won = false;
      state.activeGame = 'mud';
      say('You wake in the lobby. Type "help" to see the available commands.', 'system');
      describeRoom();
    }

    function describeRoom() {
      const room = rooms[game.currentRoom];
      const exits = Object.keys(room.exits).map((exit) => exit.toUpperCase()).join(', ') || 'none';
      say(`${room.title}: ${room.description}`, 'system');
      say(`Exits: ${exits}`, 'system');

      if (room.item) {
        say(`You can see a ${room.item} here.`, 'success');
      }

      if (game.currentRoom === 'archive' && !game.unlockedServer) {
        say('The eastern door is locked. Perhaps a card would help.', 'error');
      }
    }

    function updateMudStateLabel(text) {
      statusEl.textContent = text;
    }

    function move(direction) {
      const room = rooms[game.currentRoom];
      const destination = room.exits[direction];
      if (!destination) {
        say('You cannot go that way.', 'error');
        return;
      }

      if (game.currentRoom === 'archive' && direction === 'east' && !game.unlockedServer) {
        say('The east door is locked. You need to use the access card first.', 'error');
        return;
      }

      game.currentRoom = destination;
      say(`You move ${direction}.`, 'success');
      describeRoom();

      if (game.currentRoom === 'server') {
        game.won = true;
        updateMudStateLabel('Complete');
        say('The server room is open. Mission complete.', 'success');
      }
    }

    function take(itemName) {
      const room = rooms[game.currentRoom];
      if (!room.item || room.item.toLowerCase() !== itemName) {
        say(`There is no ${itemName} here.`, 'error');
        return;
      }

      game.inventory.push(room.item);
      say(`You take the ${room.item}.`, 'success');
      room.item = null;
    }

    function showInventory() {
      if (!game.inventory.length) {
        say('Inventory: empty', 'system');
        return;
      }

      say(`Inventory: ${game.inventory.join(', ')}`, 'system');
    }

    function useItem(itemName) {
      const hasItem = game.inventory.some((entry) => entry.toLowerCase() === itemName);
      if (!hasItem) {
        say(`You do not have ${itemName}.`, 'error');
        return;
      }

      if (game.currentRoom === 'archive' && itemName === 'access card') {
        game.unlockedServer = true;
        say('You swipe the access card. The eastern door unlocks.', 'success');
        updateMudStateLabel('Door unlocked');
        return;
      }

      say('Nothing obvious happens.', 'system');
    }

    function help() {
      say('Commands: look, north, south, east, west, take [item], use [item], inventory, map, help', 'system');
    }

    function showMap() {
      say('Map: Lobby -> Gallery -> Archive -> Server Room', 'system');
    }

    function normaliseCommand(text) {
      return text.trim().toLowerCase();
    }

    function handleCommand(rawInput) {
      const command = normaliseCommand(rawInput);
      if (!command) {
        return;
      }

      say(`> ${command}`, 'system');

      if (command === 'help') {
        help();
        return;
      }

      if (command === 'look') {
        describeRoom();
        return;
      }

      if (command === 'inventory' || command === 'i') {
        showInventory();
        return;
      }

      if (command === 'map') {
        showMap();
        return;
      }

      if (['north', 'south', 'east', 'west'].includes(command)) {
        move(command);
        return;
      }

      if (command.startsWith('take ')) {
        take(command.slice(5).trim());
        return;
      }

      if (command.startsWith('use ')) {
        useItem(command.slice(4).trim());
        return;
      }

      say('I do not understand that command.', 'error');
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      state.activeGame = 'mud';
      handleCommand(input.value);
      input.value = '';
      input.focus();
    });

    input.addEventListener('focus', () => {
      state.activeGame = 'mud';
    });

    resetButton.addEventListener('click', () => {
      resetGame();
      input.focus();
    });

    quickButtons.forEach((button) => {
      button.addEventListener('click', () => {
        state.activeGame = 'mud';
        const command = button.dataset.mudCommand || '';
        if (command === 'look') {
          handleCommand('look');
          input.focus();
          return;
        }

        if (command === 'help') {
          handleCommand('help');
          input.focus();
          return;
        }

        if (command === 'inventory') {
          handleCommand('inventory');
          input.focus();
          return;
        }

        if (command) {
          handleCommand(command);
          input.focus();
        }
      });
    });

    resetGame();
  }
})();
