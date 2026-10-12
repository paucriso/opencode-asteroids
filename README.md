# Asteroids

Clon del clásico arcade **Asteroids** implementado en canvas HTML5 puro, sin dependencias ni bundler.

## Descripción

Nave espacial en un campo de asteroides con envolvimiento de bordes (el espacio es toroidal). Destruye asteroides para sumar puntos: los grandes se parten en medianos, los medianos en pequeños. Incluye power-ups especiales, como el de **Velocidad**.

## Tecnologías

- **HTML5 Canvas** — renderizado 2D
- **JavaScript (ES6+)** — lógica del juego en un solo archivo `game.js`
- Sin frameworks, sin bundler, sin dependencias

## Cómo correr

Abre `index.html` directamente en el navegador (doble clic), o usa un servidor local:

```bash
npx serve .
```

Luego visita `http://localhost:3000`.

## Controles

| Tecla     | Acción     |
| --------- | ---------- |
| `←` `→`   | Rotar nave |
| `↑`       | Propulsar  |
| `Espacio` | Disparar   |

## Puntuación

| Asteroide | Puntos |
| --------- | ------ |
| Grande    | 20     |
| Mediano   | 50     |
| Pequeño   | 100    |

## Power-ups

Al destruir un asteroide hay una probabilidad del 10% de que suelte un ítem. Recógelo tocándolo con la nave — si no lo tomas, desaparece a los 10 segundos (parpadea como aviso antes de esfumarse).

| Ítem                | Efecto                            | Duración |
| ------------------- | --------------------------------- | -------- |
| ⚡ Velocidad (cian) | Propulsión y velocidad máxima ×2 | 5 s      |

Tomar otro ítem de Velocidad mientras el efecto está activo refresca el temporizador a 5 s (no se acumula). Perder una vida o completar el nivel cancela el efecto.

## Características

- 3 vidas con invencibilidad temporal al reaparecer (parpadeo)
- Asteroides se parten en fragmentos más pequeños al ser destruidos
- Partículas de explosión al destruir asteroides
- Power-up de **Velocidad**: propulsión ×2 durante 5 s, con drop aleatorio al destruir asteroides (10% de probabilidad)
