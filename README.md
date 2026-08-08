# Number Merge

Number Merge is a mobile-first HTML5 puzzle game where players shoot numbered blocks into lanes, merge matching values, unlock higher milestones, and keep progressing through locally saved runs.

## Live Demo

[Play Number Merge](https://merge.linkskool.com)

## Overview

This project is a React + TypeScript browser game designed for small screens first. The game uses a DOM-rendered board, touch-friendly controls, local persistence, PWA assets, player profile settings, and milestone-based progression.

The repository is frontend-focused. Game progress is stored in the browser, while optional country/language catalog data can be loaded from a configured API endpoint.

## Features

- Mobile-first number merge shooter gameplay
- 5×8 board with selectable lane targeting
- Fixed shooter origin with next-tile preview
- Orthogonal matching and chain merge resolution
- Weighted shooter tile generation based on player progress
- Milestone progression with block retirement rules
- Best score, gems, level, boosters, tutorial state, and profile persistence through browser storage
- Booster controls for hammer, swap, and undo
- Home, gameplay, pause, game-over, profile, and milestone modal screens
- Player profile with username, avatar selection, country/flag selection, and language selection
- Internationalization support with LTR/RTL document direction handling
- PWA manifest, app icons, offline page, and service worker registration
- Responsive dark/neon game UI built with CSS

## Tech Stack

- React
- TypeScript
- Vite
- Zustand
- CSS
- LocalStorage and IndexedDB
- Service Worker / PWA assets
- `country-flag-icons`

## Controls

- Tap a board lane to shoot into that column.
- Drag the current block left or right, then release to shoot.
- On desktop, use Left/Right to change the selected lane and Space or Enter to shoot.
- Press `P` to pause during gameplay.

## Screenshots

Screenshots are not currently committed to the repository.

Recommended additions:

```txt
docs/screenshots/home.png
docs/screenshots/gameplay.png
docs/screenshots/profile.png
```

Then reference them here:

```md
![Number Merge home screen](docs/screenshots/home.png)
![Number Merge gameplay screen](docs/screenshots/gameplay.png)
![Number Merge profile screen](docs/screenshots/profile.png)
```

## Architecture

The app is organized around a gameplay hook, UI components, game-rule utilities, profile storage utilities, and PWA/static assets.

```txt
src/
  App.tsx                 # App routing between home, profile, and gameplay
  main.tsx                # React entry point and providers
  components/             # Board, tiles, shooter, HUD, profile, modals, navigation
  components/avatars/     # Built-in SVG avatar data and renderer
  data/                   # Country/language catalog loading
  game/                   # Game constants, rules, milestones, leveling, tile generation
  hooks/                  # Game engine and player profile hooks
  i18n.tsx                # Localized UI strings and document direction handling
  pwa/                    # Service worker registration
  state/                  # Catalog store
  styles/                 # Global game styling
  types/                  # Shared profile/game types
  utils/                  # Browser storage and profile helpers
```

## Project Structure

```txt
public/
  icons/                  # PWA icon set
  manifest.webmanifest    # PWA manifest
  offline.html            # Offline fallback page
  robots.txt
  sitemap.xml
  sw.js                   # Service worker file

scripts/
  generate-icons.js       # Icon generation helper

package.json
vite.config.ts
tsconfig.json
```

## Getting Started

### Prerequisites

- Node.js
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Vite will print a local development URL in the terminal.

### Environment Variables

The app can run with its built-in default catalog endpoint. To override catalog settings locally, copy the example file:

```bash
cp .env.example .env.local
```

Available variables:

```txt
VITE_API_BASE_URL
VITE_API_KEY
VITE_ASSET_BASE_URL
```

Do not commit real API keys or production `.env` files.

## Available Scripts

```bash
npm run dev
```

Start the Vite development server.

```bash
npm run typecheck
```

Run TypeScript project checks.

```bash
npm run build
```

Create a production build.

```bash
npm run preview
```

Preview the production build locally.

```bash
npm run generate:icons
```

Generate PWA icon assets from the source icon.

## Deployment

The live project is available at:

[https://merge.linkskool.com](https://merge.linkskool.com)

This is a static Vite app. A production build can be generated with:

```bash
npm run build
```

Deploy the generated `dist/` folder to a static hosting provider.

## Future Improvements

- Add committed screenshots or GIFs for the README
- Add automated tests for game rules and tile generation
- Add CI checks for typechecking and production builds
- Remove generated/build artifacts from Git history if they are currently tracked
- Review whether committed environment files or public API keys need rotation
- Replace temporary development host allowances in Vite config if they are no longer needed
