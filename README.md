# Counter-Strife 2

A free tactical shooter in the style of CS2 that runs in the browser. Everything is in one HTML file:
the map, weapons, player models, textures and sounds are all generated when the page loads. There
are no downloads, accounts or store, and every skin is unlocked.

**Play:** open `index.html` (or `counter-strife-2.html`) in Chrome, Edge or Firefox, or use the hosted page.

## Modes

| Mode | What it is |
| --- | --- |
| Competitive | 5v5 bomb defusal, first to 13, sides swap at halftime, MR3 overtime at 12-12, friendly fire |
| Casual | 5v5, free armor, no friendly fire, first to 8 |
| Wingman | 2v2 on bombsite B only, first to 9 |
| Deathmatch | Free-for-all, instant respawns, free guns, 8 minutes |
| Arms Race | Gun game: every kill upgrades your weapon, win with a knife kill |

Bots come in four difficulties: Easy, Normal, Hard and Expert. They buy based on the economy, take
routes, throw smokes, flashes and molotovs on executes, plant and defuse, rotate on information,
retake sites, hear footsteps, and control recoil.

**Online:** in the Online tab, the host creates a room and shares the 5-letter code, and friends join
with it. The connection is peer-to-peer through the free PeerJS network, and bots fill empty slots.

## What's in it

- Map **de_dustline** has A and B sites, long A, catwalk, mid doors, upper and lower tunnels, B window, and CT and T spawns.
- 23 guns plus the knife, Zeus, C4 and all 6 grenades, with CS2 prices, damage, armor penetration, fire rates and kill rewards.
- Every automatic gun has a learnable spray pattern. Spread depends on movement and crouching.
- Headshots deal 4× damage, and helmets and armor absorb damage the way they do in CS.
- Bullets go through wood, doors and containers.
- The AWP and SSG 08 have two scope levels. The AUG and SG 553 scope too. The M4A1-S and USP-S silencers come off, and the Glock and FAMAS have burst fire.
- Movement follows the Source engine: friction, counter-strafing, air strafing, crouch-jumping, walking silently and stairs.
- The economy matches CS2: $800 start, the $1400–$3400 loss bonus, the $800 plant bonus and a $16,000 cap.
- The HUD has a rotating radar, a kill feed with headshot, wallbang, smoke, no-scope and blind icons, a buy menu with number-key quick buy, a scoreboard with ADR, HS% and MVPs, and damage direction arcs.
- There are also spectating, chat and radio calls, and weapon inspect.
- Settings cover a crosshair editor, sensitivity, zoom ratio, FOV and viewmodel FOV, rebindable keys, render scale and shadows, and volume.
- The inventory has 15 weapon finishes and 6 knife types, all free.

## Controls

W A S D move · Space jump · Ctrl or C crouch · Shift walk · Mouse 1 fire · Mouse 2 scope, burst, silencer or stab ·
R reload · E use, defuse or pick up · G drop · B buy · Tab scores · 1–5 weapons · Q last weapon · F inspect ·
Y chat · U team chat · M change team · Esc menu

Ctrl+W closes a browser tab. The game switches to fullscreen when a match starts and locks the
keyboard so that Ctrl+W can't close the tab. You can turn this off under Settings → Game.

## Building from source

```
npm install
node tools/vendor.js   # bundles three.js and PeerJS into vendor/
node tools/build.js    # writes index.html and counter-strife-2.html
```

The tests live in `tools/`: `smoke.js` simulates whole bot matches, `scenes.js` takes screenshots,
`inputtest.js` drives the game with a real keyboard and mouse, and `nettest.js` plays online between
two browsers.

Credits: [three.js](https://threejs.org) (MIT), [PeerJS](https://peerjs.com) (MIT), and the Barlow fonts
(SIL Open Font License). This is a fan-made game. It is not affiliated with Valve and uses none of
Valve's assets.
