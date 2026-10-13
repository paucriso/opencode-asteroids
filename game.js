'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

// Estrella fugaz (asteroide especial: rápida, desaparece con el tiempo)
const STAR_SPEED_MIN = 260;   // px/s — 3–4× más rápida que un asteroide chico
const STAR_SPEED_MAX = 340;
const STAR_RADIUS    = 11;    // pequeña y difícil de acertar
const STAR_TTL       = 6;     // segundos en pantalla antes de desvanecerse
const STAR_WARNING   = 1.5;   // segundos de parpadeo de aviso antes de expirar
const STAR_POINTS    = 300;   // bonus por destruirla (no se fragmenta)
const STAR_SPAWN_MIN = 8;     // segundos entre apariciones (máx. 1 en pantalla)
const STAR_SPAWN_MAX = 15;

class Asteroid {
  constructor(x, y, size = 3) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Estrella fugaz ────────────────────────────────────────────────────────────
// Asteroide especial: cruza el lienzo a gran velocidad y se desvanece sola.
class ShootingStar {
  constructor() {
    // Nace en un borde aleatorio del lienzo
    const lado = randInt(0, 3);   // 0: arriba, 1: derecha, 2: abajo, 3: izquierda
    if (lado === 0)      { this.x = rand(0, W); this.y = 0; }
    else if (lado === 1) { this.x = W; this.y = rand(0, H); }
    else if (lado === 2) { this.x = rand(0, W); this.y = H; }
    else                 { this.x = 0; this.y = rand(0, H); }

    // Apunta hacia el interior del lienzo (±0.5 rad respecto al centro)
    const angle = Math.atan2(H / 2 - this.y, W / 2 - this.x) + rand(-0.5, 0.5);
    const speed = rand(STAR_SPEED_MIN, STAR_SPEED_MAX);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    this.radius = STAR_RADIUS;
    this.ttl    = STAR_TTL;
    this.dead   = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) {
      this.dead = true;
      explode(this.x, this.y, 6, [255, 220, 80]);   // chispas al desvanecerse
    }
  }

  draw() {
    // Parpadeo de aviso cuando está por desaparecer
    if (this.ttl < STAR_WARNING && Math.floor(this.ttl * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.atan2(this.vy, this.vx));   // orientada a la dirección de vuelo

    // Estrella de 4 puntas, alargada en el eje del vuelo
    ctx.strokeStyle = '#ffdc50';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo( 16,  0);   // punta delantera
    ctx.lineTo(  3,  3);
    ctx.lineTo(  0, 10);   // punta lateral
    ctx.lineTo( -3,  3);
    ctx.lineTo(-16,  0);   // punta trasera
    ctx.lineTo( -3, -3);
    ctx.lineTo(  0,-10);   // punta lateral
    ctx.lineTo(  3, -3);
    ctx.closePath();
    ctx.stroke();

    // Halo tenue
    ctx.strokeStyle = 'rgba(255, 220, 80, 0.3)';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 7, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.speedBoost    = 0;   // segundos restantes del power-up "Velocidad"
    this.tripleShot    = 0;   // segundos restantes del power-up "Triple"
    this.dead          = false;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.speedBoost    > 0) this.speedBoost    -= dt;
    if (this.tripleShot    > 0) this.tripleShot    -= dt;

    const ROT   = 3.5;   // rad/s
    // Power-up "Velocidad": propulsión (y velocidad máxima) ×2; el giro no cambia
    const boost  = this.speedBoost > 0 ? 2 : 1;
    const THRUST = 260 * boost;  // px/s²
    const DRAG   = 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    // Power-up "Triple": 3 balas paralelas en línea recta (mismo ángulo, sin abanico)
    if (this.tripleShot > 0) {
      const OFF = 7;   // separación perpendicular entre balas
      const px = -Math.sin(this.angle);   // eje perpendicular al vuelo
      const py =  Math.cos(this.angle);
      return [
        new Bullet(ox - px * OFF, oy - py * OFF, this.angle),
        new Bullet(ox,            oy,            this.angle),
        new Bullet(ox + px * OFF, oy + py * OFF, this.angle),
      ];
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw() {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo( 20,  0);   // nariz
    ctx.lineTo(-12, -9);   // ala izquierda
    ctx.lineTo( -7,  0);   // muesca trasera
    ctx.lineTo(-12,  9);   // ala derecha
    ctx.closePath();
    ctx.stroke();

    // Llama del propulsor (cian y más larga con el boost de velocidad)
    if (this.thrusting && Math.random() > 0.35) {
      const boosted = this.speedBoost > 0;
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, boosted ? 22 : 14), 0);
      ctx.lineTo(-8,  4);
      ctx.strokeStyle = boosted ? 'rgba(0, 255, 255, 0.9)' : 'rgba(255, 130, 0, 0.85)';
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y, color = [255, 255, 255]) {
    this.x  = x;
    this.y  = y;
    this.color = color;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(${this.color.join(',')},${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Power-up ──────────────────────────────────────────────────────────────────
class PowerUp {
  constructor(x, y, type = 'velocidad') {
    this.x      = x;
    this.y      = y;
    this.type   = type;   // 'velocidad' | 'triple'
    this.radius = 11;
    this.ttl    = 10;     // segundos en pantalla antes de expirar
    this.dead   = false;

    const angle = rand(0, Math.PI * 2);
    const speed = rand(25, 50);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.pulse = rand(0, Math.PI * 2);   // fase del pulso visual
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.pulse += dt * 4;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    // Parpadeo de aviso cuando está por expirar
    if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;

    const s = 1 + Math.sin(this.pulse) * 0.08;   // pulso de escala

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(s, s);

    // Color distintivo por tipo: cian para "Velocidad", magenta para "Triple"
    const col = this.type === 'triple' ? '#f6f' : '#0ff';

    // Halo tenue
    ctx.strokeStyle = this.type === 'triple' ? 'rgba(255, 80, 255, 0.35)' : 'rgba(0, 255, 255, 0.35)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = col;
    ctx.lineWidth   = 2;
    ctx.lineJoin    = 'round';

    if (this.type === 'triple') {
      // Tres rayitas paralelas del power-up "Triple"
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-6, i * 5);
        ctx.lineTo( 6, i * 5);
        ctx.stroke();
      }
    } else {
      // Rayo ⚡ del power-up "Velocidad"
      ctx.beginPath();
      ctx.moveTo( 2, -8);
      ctx.lineTo(-3, -1);
      ctx.lineTo( 0, -1);
      ctx.lineTo(-2,  8);
      ctx.lineTo( 3,  1);
      ctx.lineTo( 0,  1);
      ctx.closePath();
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles, powerUps, shootingStars;
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;
let starTimer;  // cuenta atrás para la próxima estrella fugaz

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

function initGame() {
  ship          = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  powerUps  = [];
  shootingStars = [];
  starTimer = rand(STAR_SPAWN_MIN, STAR_SPAWN_MAX);
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  spawnAsteroids(4);
}

function nextLevel() {
  level++;
  bullets   = [];
  particles = [];
  powerUps  = [];
  shootingStars = [];
  starTimer = rand(STAR_SPAWN_MIN, STAR_SPAWN_MAX);
  ship.reset();
  spawnAsteroids(3 + level);
}

function explode(x, y, count = 8, color) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y, color));
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  ship.speedBoost = 0;   // perder la vida cancela los power-ups activos
  ship.tripleShot = 0;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    asteroids.forEach(a => a.update(dt));
    powerUps.forEach(pu => pu.update(dt));   // siguen derivando, pero no se recogen
    powerUps = powerUps.filter(pu => !pu.dead);
    shootingStars.forEach(e => e.update(dt));   // siguen volando, pero no matan ni se destruyen
    shootingStars = shootingStars.filter(e => !e.dead);
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  powerUps.forEach(pu => pu.update(dt));
  particles.forEach(p => p.update(dt));

  // Estrella fugaz: aparición por temporizador aleatorio, máx. 1 en pantalla
  starTimer -= dt;
  if (starTimer <= 0) {
    if (shootingStars.length === 0) shootingStars.push(new ShootingStar());
    starTimer = rand(STAR_SPAWN_MIN, STAR_SPAWN_MAX);
  }
  shootingStars.forEach(e => e.update(dt));

  // Estela cian mientras dura el boost de velocidad
  if (ship.speedBoost > 0 && Math.hypot(ship.vx, ship.vy) > 40) {
    const p = new Particle(ship.x, ship.y, [0, 255, 255]);
    p.vx = rand(-15, 15) - ship.vx * 0.15;
    p.vy = rand(-15, 15) - ship.vy * 0.15;
    p.life *= 0.5;
    p.ttl  = p.life;
    particles.push(p);
  }

  // Estela dorada de la estrella fugaz (2 partículas por frame)
  for (const e of shootingStars) {
    for (let i = 0; i < 2; i++) {
      const p = new Particle(e.x, e.y, [255, 220, 80]);
      p.vx = rand(-15, 15) - e.vx * 0.15;
      p.vy = rand(-15, 15) - e.vy * 0.15;
      p.life *= 0.5;
      p.ttl  = p.life;
      particles.push(p);
    }
  }

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);
  powerUps  = powerUps.filter(pu => !pu.dead);
  shootingStars = shootingStars.filter(e => !e.dead);

  // Nave vs power-up: recoger (refresca el temporizador a 5 s, no apila)
  for (const pu of powerUps) {
    if (dist(ship, pu) < ship.radius + pu.radius) {
      pu.dead = true;
      if (pu.type === 'triple') {
        ship.tripleShot = 5;
        explode(pu.x, pu.y, 8, [255, 80, 255]);   // chispas magenta
      } else {
        ship.speedBoost = 5;
        explode(pu.x, pu.y, 8, [0, 255, 255]);    // chispas cian
      }
    }
  }
  powerUps = powerUps.filter(pu => !pu.dead);

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        score += POINTS[a.size];
        explode(a.x, a.y, a.size * 5);
        newAsteroids.push(...a.split());
        // Drop de power-up: 10% de probabilidad, máx. 2 en pantalla, tipo al azar
        if (Math.random() < 0.10 && powerUps.length < 2)
          powerUps.push(new PowerUp(a.x, a.y, Math.random() < 0.5 ? 'velocidad' : 'triple'));
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Bala vs estrella fugaz: no se fragmenta ni dropea power-ups
  for (const b of bullets) {
    for (const e of shootingStars) {
      if (!e.dead && !b.dead && dist(b, e) < e.radius) {
        b.dead = true;
        e.dead = true;
        score += STAR_POINTS;
        explode(e.x, e.y, 12, [255, 220, 80]);
      }
    }
  }
  bullets       = bullets.filter(b => !b.dead);
  shootingStars = shootingStars.filter(e => !e.dead);

  // Nave vs asteroide / estrella fugaz
  if (ship.invincible <= 0) {
    for (const a of asteroids) {
      if (dist(ship, a) < ship.radius + a.radius * 0.82) {
        killShip();
        break;
      }
    }
    for (const e of shootingStars) {
      if (!ship.dead && dist(ship, e) < ship.radius + e.radius) {
        killShip();
        break;
      }
    }
  }

  // Nivel completado (la nave pudo morir contra una estrella en este mismo frame)
  if (state === 'playing' && asteroids.length === 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 1.2;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo( 9,  0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3,  0);
  ctx.lineTo(-6,  5);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  // Indicadores de power-ups activos (parpadean en el último segundo)
  const efectos = [
    ['VELOCIDAD', ship.speedBoost, '#0ff', 48],
    ['TRIPLE',    ship.tripleShot, '#f6f', 70],
  ];
  for (const [nombre, t, color, y] of efectos) {
    if (t <= 0) continue;
    const parpadea = t < 1 && Math.floor(t * 8) % 2 === 0;
    if (parpadea) continue;
    ctx.fillStyle = color;
    ctx.fillText(`${nombre} ${t.toFixed(1)}s`, 14, y);
  }
  ctx.fillStyle = '#fff';

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  shootingStars.forEach(e => e.draw());
  powerUps.forEach(pu => pu.draw());
  bullets.forEach(b => b.draw());
  ship.draw();

  drawHUD();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
