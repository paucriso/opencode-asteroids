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

// ── Skins ─────────────────────────────────────────────────────────────────────
// Apariencias de la nave: cada skin define la silueta (vértices relativos al
// centro, con la nariz en ~+20 y la cola en ~-12 para no alterar la hitbox ni
// la salida de balas), color RGB de trazo, relleno tenue opcional y color de
// la llama del propulsor.
const SKINS = [
  { nombre: 'CLÁSICA',     color: [255, 255, 255], relleno: null,                    llama: 'rgba(255,130,0,0.85)',  forma: [[20,0],[-12,-9],[-7,0],[-12,9]] },
  { nombre: 'NEBULOSA',    color: [201,160,255],  relleno: 'rgba(201,160,255,0.12)', llama: 'rgba(190,110,255,0.85)', forma: [[22,0],[-13,-6],[-5,0],[-13,6]] },
  { nombre: 'INTERCEPTOR', color: [ 77,216,255], relleno: 'rgba(77,216,255,0.12)',  llama: 'rgba(150,200,255,0.85)', forma: [[21,0],[-5,-11],[-14,-5],[-14,5],[-5,11]] },
  { nombre: 'RETRO',       color: [125,255,106], relleno: 'rgba(125,255,106,0.10)', llama: 'rgba(200,255,120,0.85)', forma: [[15,-8],[17,0],[15,8],[-10,8],[-13,0],[-10,-8]] },
  { nombre: 'CAZADOR',     color: [255, 90, 90], relleno: 'rgba(255,90,90,0.12)',   llama: 'rgba(255,80,80,0.85)',   forma: [[21,0],[-7,-8],[-13,-9],[-9,0],[-13,9],[-7,8]] },
  { nombre: 'DORADA',      color: [255,210, 77], relleno: 'rgba(255,210,77,0.12)',  llama: 'rgba(255,200,60,0.85)',  forma: [[18,0],[-13,-10],[-4,-4],[-4,4],[-13,10]] },
];
// Color de trazo CSS precalculado a partir del RGB (nave, iconos y explosión)
SKINS.forEach(s => { s.trazo = `rgb(${s.color.join(',')})`; });

let skinIndex = 0;    // skin activa (sin persistencia: siempre arranca en CLÁSICA)
let skinMsgTtl = 0;   // segundos restantes del aviso "SKIN: ..." en el HUD

// Traza la silueta de una skin como path (para la nave y los iconos de vidas)
function tracePath(forma) {
  ctx.beginPath();
  ctx.moveTo(forma[0][0], forma[0][1]);
  for (let i = 1; i < forma.length; i++)
    ctx.lineTo(forma[i][0], forma[i][1]);
  ctx.closePath();
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
    this.shield        = 0;   // segundos restantes del power-up "Escudo"
    this.shieldPulse   = 0;   // fase del pulso/rotación visual del escudo
    this.dead          = false;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.speedBoost    > 0) this.speedBoost    -= dt;
    if (this.shield > 0) { this.shield -= dt; this.shieldPulse += dt * 4; }

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
    return [new Bullet(ox, oy, this.angle)];
  }

  draw() {
    if (this.dead) return;

    // Escudo activo: hexágono violeta pulsante alrededor de la nave
    if (this.shield > 0) {
      // Parpadeo de aviso en el último segundo
      const parpadea = this.shield < 1 && Math.floor(this.shield * 8) % 2 === 0;
      if (!parpadea) {
        const s = 1 + Math.sin(this.shieldPulse) * 0.05;   // pulso de escala
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.strokeStyle = 'rgba(186, 140, 255, 0.85)';
        ctx.lineWidth   = 1.5;
        ctx.lineJoin    = 'round';
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + this.shieldPulse * 0.15;   // rota despacio
          const px = Math.cos(a) * SHIELD_RADIUS * s;
          const py = Math.sin(a) * SHIELD_RADIUS * s;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
    }

    // Parpadeo durante invencibilidad de reaparición (oculta el cuerpo, no el escudo)
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    const skin = SKINS[skinIndex];

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = skin.trazo;
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    // Silueta de la skin activa (relleno tenue opcional + trazo)
    tracePath(skin.forma);
    if (skin.relleno) { ctx.fillStyle = skin.relleno; ctx.fill(); }
    ctx.stroke();

    // Llama del propulsor (color de la skin; cian y más larga con el boost de velocidad)
    if (this.thrusting && Math.random() > 0.35) {
      const boosted = this.speedBoost > 0;
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, boosted ? 22 : 14), 0);
      ctx.lineTo(-8,  4);
      ctx.strokeStyle = boosted ? 'rgba(0, 255, 255, 0.9)' : skin.llama;
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
// Power-up "Escudo": protección temporizada; lo que toca su hexágono se destruye
const SHIELD_DURATION = 5;   // segundos de protección al recogerlo
const SHIELD_RADIUS   = 26;  // radio de colisión y dibujo alrededor de la nave

class PowerUp {
  constructor(x, y, type = 'velocidad') {
    this.x      = x;
    this.y      = y;
    this.type   = type;   // 'velocidad' | 'escudo'
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

    // Halo tenue (cian para "Velocidad", violeta para "Escudo")
    ctx.strokeStyle = this.type === 'escudo' ? 'rgba(186, 140, 255, 0.35)' : 'rgba(0, 255, 255, 0.35)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = this.type === 'escudo' ? '#b98cff' : '#0ff';
    ctx.lineWidth   = 2;
    ctx.lineJoin    = 'round';
    ctx.beginPath();

    if (this.type === 'escudo') {
      // Hexágono del power-up "Escudo"
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const px = Math.cos(a) * 8;
        const py = Math.sin(a) * 8;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
    } else {
      // Rayo ⚡ del power-up "Velocidad"
      ctx.moveTo( 2, -8);
      ctx.lineTo(-3, -1);
      ctx.lineTo( 0, -1);
      ctx.lineTo(-2,  8);
      ctx.lineTo( 3,  1);
      ctx.lineTo( 0,  1);
    }

    ctx.closePath();
    ctx.stroke();

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

// Destruye un asteroide: puntos, chispas, fragmentos y posible drop de power-up
function destroyAsteroid(a) {
  a.dead = true;
  score += POINTS[a.size];
  explode(a.x, a.y, a.size * 5);
  // Drop de power-up: 10% de probabilidad, máx. 2 en pantalla, 50/50 de tipo
  if (Math.random() < 0.10 && powerUps.length < 2)
    powerUps.push(new PowerUp(a.x, a.y, Math.random() < 0.5 ? 'velocidad' : 'escudo'));
  return a.split();
}

function killShip() {
  explode(ship.x, ship.y, 14, SKINS[skinIndex].color);   // chispas del color de la skin
  ship.dead = true;
  ship.speedBoost = 0;   // perder la vida cancela el boost...
  ship.shield = 0;       // ...y el escudo
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
  if (skinMsgTtl > 0) skinMsgTtl -= dt;

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

  // Cambiar de skin (C rota entre las disponibles)
  if (pressed('KeyC')) {
    skinIndex = (skinIndex + 1) % SKINS.length;
    skinMsgTtl = 1.5;
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

  // Nave vs power-up: recoger (refresca el temporizador, no apila)
  for (const pu of powerUps) {
    if (dist(ship, pu) < ship.radius + pu.radius) {
      pu.dead = true;
      if (pu.type === 'escudo') {
        ship.shield = SHIELD_DURATION;
        explode(pu.x, pu.y, 8, [186, 140, 255]);
      } else {
        ship.speedBoost = 5;
        explode(pu.x, pu.y, 8, [0, 255, 255]);
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
        newAsteroids.push(...destroyAsteroid(a));
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
  if (ship.shield > 0) {
    // Escudo activo: la amenaza se destruye al tocar el hexágono (con puntos)
    const shieldFrags = [];
    for (const a of asteroids) {
      if (!a.dead && dist(ship, a) < SHIELD_RADIUS + a.radius * 0.82) {
        shieldFrags.push(...destroyAsteroid(a));
        explode(a.x, a.y, 6, [186, 140, 255]);   // chispas violetas del impacto
      }
    }
    asteroids = asteroids.filter(a => !a.dead).concat(shieldFrags);
    for (const e of shootingStars) {
      if (!e.dead && dist(ship, e) < SHIELD_RADIUS + e.radius) {
        e.dead = true;
        score += STAR_POINTS;
        explode(e.x, e.y, 12, [255, 220, 80]);
      }
    }
    shootingStars = shootingStars.filter(e => !e.dead);
  } else if (ship.invincible <= 0) {
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
  const skin = SKINS[skinIndex];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.scale(0.45, 0.45);   // misma silueta de la nave, reducida
  ctx.strokeStyle = skin.trazo;
  ctx.lineWidth   = 2.6;   // ~1.2 efectivo tras la escala
  ctx.lineJoin    = 'round';
  tracePath(skin.forma);
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  // Indicador del power-up "Velocidad" activo (parpadea en el último segundo)
  if (ship.speedBoost > 0) {
    const parpadea = ship.speedBoost < 1 && Math.floor(ship.speedBoost * 8) % 2 === 0;
    if (!parpadea) {
      ctx.fillStyle = '#0ff';
      ctx.fillText(`VELOCIDAD ${ship.speedBoost.toFixed(1)}s`, 14, 48);
      ctx.fillStyle = '#fff';
    }
  }

  // Indicador del power-up "Escudo" activo (parpadea en el último segundo)
  if (ship.shield > 0) {
    const parpadea = ship.shield < 1 && Math.floor(ship.shield * 8) % 2 === 0;
    if (!parpadea) {
      ctx.fillStyle = '#b98cff';
      ctx.fillText(`ESCUDO ${ship.shield.toFixed(1)}s`, 14, 70);
      ctx.fillStyle = '#fff';
    }
  }

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  // Aviso de skin recién cambiada (se desvanece en el último medio segundo)
  if (skinMsgTtl > 0) {
    ctx.globalAlpha = Math.min(1, skinMsgTtl / 0.5);
    ctx.fillStyle = SKINS[skinIndex].trazo;
    ctx.fillText(`SKIN: ${SKINS[skinIndex].nombre}`, W / 2, 48);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
  }

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
