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

const snakeCanvas = document.getElementById('snake-canvas');
const snakeScore = document.getElementById('snake-score');
const snakeStatus = document.getElementById('snake-status');
const snakeRestart = document.getElementById('snake-restart');
const touchButtons = document.querySelectorAll('.touch-pad button[data-dir]');

if (snakeCanvas && snakeScore && snakeStatus && snakeRestart) {
  const ctx = snakeCanvas.getContext('2d');
  const gridSize = 24;
  const cellSize = snakeCanvas.width / gridSize;
  const speedMs = 120;

  let snake;
  let direction;
  let pendingDirection;
  let food;
  let score;
  let timerId;
  let started;
  let gameOver;

  function randomCell() {
    return {
      x: Math.floor(Math.random() * gridSize),
      y: Math.floor(Math.random() * gridSize),
    };
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

  function spawnFood() {
    let next = randomCell();
    while (snake.some((segment) => sameCell(segment, next))) {
      next = randomCell();
    }
    return next;
  }

  function resetGame() {
    snake = [
      { x: 10, y: 12 },
      { x: 9, y: 12 },
      { x: 8, y: 12 },
    ];
    direction = { x: 1, y: 0 };
    pendingDirection = { x: 1, y: 0 };
    score = 0;
    started = false;
    gameOver = false;
    food = spawnFood();
    snakeScore.textContent = String(score);
    snakeStatus.textContent = 'Ready';
    draw();
  }

  function setStatus(value) {
    snakeStatus.textContent = value;
  }

  function setDirection(next) {
    if (!started && !gameOver) {
      started = true;
      setStatus('Playing');
      startLoop();
    }

    if (isOpposite(next, direction)) {
      return;
    }

    pendingDirection = next;
  }

  function move() {
    if (gameOver) {
      return;
    }

    direction = pendingDirection;
    const head = snake[0];
    const nextHead = {
      x: head.x + direction.x,
      y: head.y + direction.y,
    };

    const hitWall =
      nextHead.x < 0 ||
      nextHead.x >= gridSize ||
      nextHead.y < 0 ||
      nextHead.y >= gridSize;

    const hitSelf = snake.some((segment) => sameCell(segment, nextHead));

    if (hitWall || hitSelf) {
      gameOver = true;
      setStatus('Game Over');
      stopLoop();
      draw();
      return;
    }

    snake.unshift(nextHead);

    if (sameCell(nextHead, food)) {
      score += 1;
      snakeScore.textContent = String(score);
      food = spawnFood();
    } else {
      snake.pop();
    }

    draw();
  }

  function drawGrid() {
    ctx.strokeStyle = 'rgba(132, 240, 179, 0.06)';
    ctx.lineWidth = 1;

    for (let i = 1; i < gridSize; i += 1) {
      const position = i * cellSize;
      ctx.beginPath();
      ctx.moveTo(position, 0);
      ctx.lineTo(position, snakeCanvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, position);
      ctx.lineTo(snakeCanvas.width, position);
      ctx.stroke();
    }
  }

  function drawCell(cell, fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fillRect(
      cell.x * cellSize + 1,
      cell.y * cellSize + 1,
      cellSize - 2,
      cellSize - 2
    );
  }

  function draw() {
    ctx.clearRect(0, 0, snakeCanvas.width, snakeCanvas.height);
    drawGrid();

    drawCell(food, '#ff6f61');

    snake.forEach((segment, index) => {
      drawCell(segment, index === 0 ? '#84f0b3' : '#2f8f65');
    });

    if (gameOver) {
      ctx.fillStyle = 'rgba(5, 16, 12, 0.72)';
      ctx.fillRect(0, 0, snakeCanvas.width, snakeCanvas.height);
      ctx.fillStyle = '#eaf6ef';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Game Over', snakeCanvas.width / 2, snakeCanvas.height / 2 - 8);
      ctx.font = '16px sans-serif';
      ctx.fillText('Restart to play again', snakeCanvas.width / 2, snakeCanvas.height / 2 + 26);
    }
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

  function restartGame() {
    stopLoop();
    resetGame();
  }

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();

    if (['arrowup', 'w'].includes(key)) {
      event.preventDefault();
      setDirection({ x: 0, y: -1 });
    } else if (['arrowdown', 's'].includes(key)) {
      event.preventDefault();
      setDirection({ x: 0, y: 1 });
    } else if (['arrowleft', 'a'].includes(key)) {
      event.preventDefault();
      setDirection({ x: -1, y: 0 });
    } else if (['arrowright', 'd'].includes(key)) {
      event.preventDefault();
      setDirection({ x: 1, y: 0 });
    }
  });

  touchButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const dir = button.dataset.dir;
      const map = {
        up: { x: 0, y: -1 },
        down: { x: 0, y: 1 },
        left: { x: -1, y: 0 },
        right: { x: 1, y: 0 },
      };
      setDirection(map[dir]);
    });
  });

  let pointerStart = null;

  snakeCanvas.addEventListener('pointerdown', (event) => {
    pointerStart = { x: event.clientX, y: event.clientY };
  });

  snakeCanvas.addEventListener('pointerup', (event) => {
    if (!pointerStart) {
      return;
    }

    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (Math.max(absX, absY) < 18) {
      pointerStart = null;
      return;
    }

    if (absX > absY) {
      setDirection(dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 });
    } else {
      setDirection(dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 });
    }

    pointerStart = null;
  });

  snakeRestart.addEventListener('click', restartGame);

  resetGame();
  startLoop();
}
