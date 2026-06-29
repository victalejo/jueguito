# 🧬 Evolución — *Soup Genesis: Rise of the Cell*

Un juego de **supervivencia arcade** en el caldo primigenio: empiezas como una simple **molécula autorreplicante** y evolucionas, etapa a etapa, hasta convertirte en un **organismo apex**. Recolecta moléculas para crecer, esquiva radicales, toxinas y depredadores, y muta para adaptarte a un planeta cada vez más hostil.

Construido con **Phaser 3 + Vite + TypeScript**. Sin assets externos: **cada textura se genera proceduralmente** y **todo el sonido se sintetiza con Web Audio** — funciona offline, sin descargas.

---

## ▶️ Cómo ejecutarlo

Requisitos: **Node.js 18+** (probado en Node 26) y npm.

```bash
npm install      # instalar dependencias
npm run dev      # servidor de desarrollo con recarga en caliente → http://localhost:5173
```

Otros comandos:

```bash
npm run build    # type-check + build de producción a dist/
npm run preview  # servir el build de producción
npm run typecheck# solo verificación de tipos
```

---

## 🎮 Cómo se juega

**Objetivo:** sobrevive, come y evoluciona. Llena la barra de **biomasa** para evolucionar y elegir una **mutación**. Llega a la etapa apex y sobrevive **60 segundos** para ganar.

| Acción | Tecla |
|---|---|
| Nadar | **WASD** / **Flechas** |
| Apuntar (opcional) | **Ratón** |
| Habilidad principal de la etapa | **Espacio** / **Clic izquierdo** |
| Esquiva (impulso) | **E** *(desde Protocélula)* |
| Sprint (gasta energía) | **Shift** |
| Pausa | **Esc** / **P** |
| Elegir mutación | **1 / 2 / 3** o clic |
| Silenciar | **M** |

**Bucle central:**
1. Recolecta moléculas → ganas **energía** (combustible) y **biomasa** (progreso).
2. La energía **drena con el tiempo** (hambre): si llega a 0, te mueres de inanición.
3. Esquiva las **amenazas** (cada una se mueve distinto: vagan, persiguen, emboscan, cazan en grupo).
4. Al llenar la biomasa, **evolucionas** y eliges una de 3 **mutaciones** permanentes.
5. Cada etapa: más rápida, más amenazas, más biomasa requerida… pero tú también creces.

---

## 🧫 Contenido

- **7 etapas evolutivas:** Molécula → Protocélula → Procariota → Eucariota → Cúmulo Colonial → Organismo Multicelular → Organismo Apex. Cada una con apariencia, estadísticas, habilidad y entorno propios.
- **8 nutrientes** con distinto valor de energía/biomasa y rareza (azúcar, aminoácido, lípido, nucleótido, ion mineral, ATP, cúmulo proteico, cristal prebiótico).
- **9 amenazas** con comportamientos únicos (radical libre, mancha tóxica, estallido UV, microbio depredador, bacteriófago, corriente ácida, amiba cazadora, medusa tóxica, depredador apex).
- **18 mutaciones** en 3 niveles (metabolismo eficiente, membrana gruesa, armadura reactiva, sobremarcha mitótica, instinto apex…).
- **Habilidades por etapa:** Impulso, Pulso Tóxico, Fagocitar, Giro Barredor, Embestida Contráctil.
- **Oleadas escaladas** cada 30 s, con peligros globales telegrafiados cada 3.ª oleada.
- **Guardado** (localStorage): mejor etapa, récord de puntuación y mutaciones desbloqueadas.

---

## 🏗️ Arquitectura

Muchos archivos pequeños, alta cohesión y bajo acoplamiento. Las escenas y sistemas se comunican **solo** a través de un `EventBus` tipado guardado en el registry — ninguna escena lee el estado de otra.

```
src/
├── main.ts                 # arranque de Phaser.Game
├── config/                 # gameConfig + constants (BALANCE, VIEW, WORLD, TEX, COLORS)
├── types/                  # contratos de tipos compartidos (eventos tipados incluidos)
├── core/                   # EventBus, audio (interfaz + WebAudioManager), registryKeys
├── data/                   # datos puros: etapas, nutrientes, amenazas, mutaciones, oleadas, paletas, guardado
├── utils/                  # mathUtils, random (RNG sembrable), validación, cuerpos, TextureFactory
├── entities/               # Player, Nutrient, Threat, threatBehaviors, ParticleBurst
├── systems/                # Spawn, Wave, Evolution, Collision, Score, Input, Save
├── ui/                     # Button, Bar, Toast, MutationCard, MutationIconStrip, SoupBackdrop
└── scenes/                 # Boot, Menu, Game, HUD (overlay), Evolution, Pause, GameOver
```

- **BootScene** genera todas las texturas procedurales y registra los singletons (EventBus, SaveSystem, AudioManager).
- **GameScene** es la única escena que simula el mundo; **HUDScene** es un overlay paralelo guiado por eventos.
- Evolución, pausa y fin de partida son overlays modales que pausan la simulación.
- Las colisiones se resuelven por **distancia** (radio de recolección amplio, hitbox de daño ajustado y justo).

---

## 🛠️ Stack

- **[Phaser 3.90](https://phaser.io/)** — motor de juego 2D (Canvas/WebGL)
- **[Vite 6](https://vitejs.dev/)** — bundler + servidor de desarrollo
- **TypeScript 5** (estricto)

> Nota: en modo desarrollo la instancia del juego se expone como `window.game` para depuración. No ocurre en el build de producción.

¡Que disfrutes evolucionando! 🦠→🧬
