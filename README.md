# Pixel Void

A browser-based space shooter built around a simple idea: what if the games on those old brick game handhelds were actually Star Wars?

Pilot the Millennium Falcon through six sectors of Imperial space, fight through escalating enemy formations, and take down a Star Destroyer in the final sector. Built with HTML5 Canvas — no install, no dependencies, runs in any browser.

**[Play it here](https://abhisan1.github.io/Pixel-Void/)**

---

## How to Play

- **Move:** Arrow keys or WASD
- **Fire:** Automatic
- **Power-ups:** F and G keys to activate equipped power-ups
- **Pause:** Escape

Destroy enemies to earn coins and collect fuel cells they drop. Each sector has a fuel requirement — collect enough to advance. Spend coins in the Hangar between sectors to upgrade your ship.

---

## Features

- 6 sectors, each with a Star Wars-style opening crawl
- 3 enemy types: fighters, bombers, scouts
- Star Destroyer boss fight with 3 phases — only the bridge takes damage
- Hangar upgrade system: cannon, engine, shield (5 levels each)
- Single-use power-ups: homing missiles, ion pulse, proton torpedo, scrap magnet
- Fuel collection mechanic — you have to fly into the field to gather cells
- New Game+ mode after completing the campaign
- Saves progress to localStorage

---

## Tech

Vanilla JavaScript and HTML5 Canvas. No frameworks, no libraries, no build step. Two files: `index.html` and `game.js`.

---

## Run Locally

```
git clone https://github.com/Abhisan1/Pixel-Void
cd Pixel-Void
# Open index.html in any browser, or use Live Server in VS Code
```
