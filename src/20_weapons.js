/* ===================== weapons, grenades, equipment ===================== */
// Stats follow CS2 closely: damage, armor penetration, range modifier (per 500 units), RPM, magazines, prices, rewards, speed (units/s).
// sp: spread in degrees [stand, crouch, fullMove, air, perShot, recoverPerSec, maxAccum]
// rc: recoil pattern params (degrees of bullet deviation)
const W = {};
function defW(id, o) { o.id = id; W[id] = o; return o; }
const RP = (kick, rise, plat, sway, per, dir, jit, seed, rec) => ({ kick, rise, plat, sway, per, dir, jit, seed, rec: rec || 14 });

// ---- pistols ----
defW('glock', { name: 'Glock-18', slot: 2, cat: 'pistol', team: 'T', price: 200, reward: 300, dmg: 30, ap: .47, rm: .85, rpm: 400, mag: 20, res: 120, rl: 2.27, dep: .9, spd: 240, burst: true, pen: .25, snd: 'g_pistol', sp: [.35, .28, 2.4, 5, .5, 3, 3], rc: RP(.5, 3, .15, .6, 5, 1, .12, 3, 10), m: { kind: 'pistol', len: .19, col: 0x2a2c2e, fur: 0x1d1e20, style: 'glock' } });
defW('usp', { name: 'USP-S', slot: 2, cat: 'pistol', team: 'CT', price: 200, reward: 300, dmg: 35, ap: .505, rm: .99, rpm: 352, mag: 12, res: 24, rl: 2.2, dep: .9, spd: 240, sil: true, pen: .25, snd: 'g_pistol', sp: [.22, .17, 2.2, 5, .6, 3.5, 3], rc: RP(.7, 3, .2, .5, 5, -1, .12, 5, 10), m: { kind: 'pistol', len: .2, col: 0x303336, fur: 0x222427, style: 'usp' } });
defW('p250', { name: 'P250', slot: 2, cat: 'pistol', team: null, price: 300, reward: 300, dmg: 38, ap: .64, rm: .9, rpm: 400, mag: 13, res: 26, rl: 2.2, dep: .9, spd: 240, pen: .3, snd: 'g_pistol', sp: [.3, .24, 2.4, 5, .8, 3, 3.5], rc: RP(.9, 3, .2, .6, 5, 1, .15, 7, 9), m: { kind: 'pistol', len: .18, col: 0x3a3c3a, fur: 0x262726, style: 'p250' } });
defW('fiveseven', { name: 'Five-SeveN', slot: 2, cat: 'pistol', team: 'CT', price: 500, reward: 300, dmg: 32, ap: .91, rm: .85, rpm: 400, mag: 20, res: 100, rl: 2.2, dep: .9, spd: 240, pen: .35, snd: 'g_pistol', sp: [.28, .22, 2.3, 5, .7, 3, 3.5], rc: RP(.8, 3, .2, .6, 5, -1, .15, 9, 9), m: { kind: 'pistol', len: .2, col: 0x4b4d48, fur: 0x2c2d2a, style: 'fiveseven' } });
defW('tec9', { name: 'Tec-9', slot: 2, cat: 'pistol', team: 'T', price: 500, reward: 300, dmg: 33, ap: .906, rm: .83, rpm: 500, mag: 18, res: 90, rl: 2.5, dep: .9, spd: 240, pen: .35, snd: 'g_pistol', sp: [.45, .38, 1.8, 4, .6, 3, 3.5], rc: RP(.75, 4, .2, .8, 6, 1, .15, 11, 9), m: { kind: 'pistol', len: .26, col: 0x2d2f33, fur: 0x1b1c1f, style: 'tec9' } });
defW('deagle', { name: 'Desert Eagle', slot: 2, cat: 'pistol', team: null, price: 700, reward: 300, dmg: 53, ap: .932, rm: .81, rpm: 267, mag: 7, res: 35, rl: 2.2, dep: 1.0, spd: 230, pen: .5, snd: 'g_heavyp', sp: [.28, .2, 3.5, 6, 2.0, 3.2, 5], rc: RP(2.2, 2, .4, 1, 4, 1, .3, 13, 6), m: { kind: 'pistol', len: .26, col: 0x8d8f92, fur: 0x2b2b2b, style: 'deagle' } });
// ---- SMGs ----
defW('mac10', { name: 'MAC-10', slot: 1, cat: 'smg', team: 'T', price: 1050, reward: 600, dmg: 29, ap: .575, rm: .8, rpm: 800, mag: 30, res: 100, rl: 2.6, dep: 1.0, spd: 240, auto: true, pen: .2, snd: 'g_smg', sp: [.7, .6, 1.6, 4, .14, 3, 2.2], rc: RP(.35, 10, .05, 2.2, 6, 1, .2, 21), m: { kind: 'smg', len: .26, col: 0x2e2f31, fur: 0x1e1f21, mag: 'pistol', stock: 'wire', barrel: .06, style: 'mac10' } });
defW('mp9', { name: 'MP9', slot: 1, cat: 'smg', team: 'CT', price: 1250, reward: 600, dmg: 26, ap: .6, rm: .87, rpm: 857, mag: 30, res: 120, rl: 2.1, dep: 1.0, spd: 240, auto: true, pen: .2, snd: 'g_smg', sp: [.6, .5, 1.5, 4, .13, 3, 2.0], rc: RP(.32, 10, .05, 1.8, 6, -1, .18, 23), m: { kind: 'smg', len: .3, col: 0x26282a, fur: 0x1c1d1f, mag: 'pistol', stock: 'fold', barrel: .08, style: 'mp9' } });
defW('mp7', { name: 'MP7', slot: 1, cat: 'smg', team: null, price: 1500, reward: 600, dmg: 29, ap: .625, rm: .85, rpm: 750, mag: 30, res: 120, rl: 3.1, dep: 1.0, spd: 220, auto: true, pen: .25, snd: 'g_smg', sp: [.45, .38, 1.6, 4, .12, 3, 2.0], rc: RP(.3, 10, .05, 1.2, 7, 1, .15, 25), m: { kind: 'smg', len: .34, col: 0x2a2c2f, fur: 0x1b1c1e, mag: 'pistol', stock: 'solid', barrel: .1, rail: true, style: 'mp7' } });
defW('ump45', { name: 'UMP-45', slot: 1, cat: 'smg', team: null, price: 1200, reward: 600, dmg: 35, ap: .65, rm: .75, rpm: 666, mag: 25, res: 100, rl: 3.5, dep: 1.0, spd: 230, auto: true, pen: .25, snd: 'g_smg', sp: [.5, .42, 1.7, 4, .15, 3, 2.2], rc: RP(.38, 9, .06, 1.6, 6, -1, .18, 27), m: { kind: 'smg', len: .42, col: 0x2f3134, fur: 0x1f2022, mag: 'straight', stock: 'solid', barrel: .12, rail: true, style: 'ump' } });
defW('p90', { name: 'P90', slot: 1, cat: 'smg', team: null, price: 2350, reward: 300, dmg: 26, ap: .69, rm: .86, rpm: 857, mag: 50, res: 100, rl: 3.4, dep: 1.0, spd: 230, auto: true, pen: .25, snd: 'g_smg', sp: [.55, .46, 1.6, 4, .1, 3, 2.0], rc: RP(.22, 12, .05, 1.6, 8, 1, .15, 29), m: { kind: 'smg', len: .5, col: 0x2b2d2b, fur: 0x3b4034, mag: 'top', stock: 'none', barrel: .06, style: 'p90' } });
// ---- rifles ----
defW('galil', { name: 'Galil AR', slot: 1, cat: 'rifle', team: 'T', price: 1800, reward: 300, dmg: 30, ap: .775, rm: .98, rpm: 666, mag: 35, res: 90, rl: 3.0, dep: 1.1, spd: 215, auto: true, pen: .55, snd: 'g_rifle', sp: [.24, .18, 5, 11, .24, 4, 3], rc: RP(.45, 9, .03, 1.8, 7, -1, .2, 31), m: { kind: 'rifle', len: .7, col: 0x3a3d33, fur: 0x4b5038, mag: 'curved', stock: 'skeleton', barrel: .2, style: 'galil' } });
defW('famas', { name: 'FAMAS', slot: 1, cat: 'rifle', team: 'CT', price: 2050, reward: 300, dmg: 30, ap: .7, rm: .96, rpm: 666, mag: 25, res: 90, rl: 3.3, dep: 1.1, spd: 220, auto: true, burst: true, pen: .55, snd: 'g_m4', sp: [.2, .15, 5, 11, .22, 4, 3], rc: RP(.4, 8, .04, 1.4, 6, 1, .2, 33), m: { kind: 'rifle', len: .62, col: 0x2d2f33, fur: 0x2d2f33, mag: 'straight', stock: 'none', barrel: .16, bpup: true, handle: true, style: 'famas' } });
defW('ak47', { name: 'AK-47', slot: 1, cat: 'rifle', team: 'T', price: 2700, reward: 300, dmg: 36, ap: .775, rm: .98, rpm: 600, mag: 30, res: 90, rl: 2.5, dep: 1.1, spd: 215, auto: true, pen: .6, snd: 'g_rifle', sp: [.2, .14, 6, 12, .26, 4, 3], rc: RP(.55, 9, .03, 2.0, 7, -1, .22, 37), m: { kind: 'rifle', len: .74, col: 0x2a2a2a, fur: 0x8a4f22, mag: 'curved', stock: 'wood', barrel: .22, style: 'ak' } });
defW('m4a4', { name: 'M4A4', slot: 1, cat: 'rifle', team: 'CT', price: 3100, reward: 300, dmg: 33, ap: .7, rm: .97, rpm: 666, mag: 30, res: 90, rl: 3.1, dep: 1.1, spd: 225, auto: true, pen: .6, snd: 'g_m4', sp: [.16, .12, 5.5, 11, .22, 4, 2.8], rc: RP(.45, 9, .03, 1.4, 7, 1, .2, 39), m: { kind: 'rifle', len: .72, col: 0x232426, fur: 0x2c2d30, mag: 'straight', stock: 'solid', barrel: .22, rail: true, style: 'm4' } });
defW('m4a1s', { name: 'M4A1-S', slot: 1, cat: 'rifle', team: 'CT', price: 2900, reward: 300, dmg: 38, ap: .7, rm: .99, rpm: 600, mag: 20, res: 80, rl: 3.1, dep: 1.1, spd: 225, auto: true, sil: true, pen: .6, snd: 'g_m4', sp: [.13, .1, 5.5, 11, .2, 4, 2.6], rc: RP(.38, 8, .03, 1.0, 7, -1, .18, 41), m: { kind: 'rifle', len: .7, col: 0x2a2c2f, fur: 0x34363a, mag: 'straight', stock: 'solid', barrel: .18, rail: true, style: 'm4s' } });
defW('sg553', { name: 'SG 553', slot: 1, cat: 'rifle', team: 'T', price: 3000, reward: 300, dmg: 30, ap: 1.0, rm: .98, rpm: 545, mag: 30, res: 90, rl: 2.8, dep: 1.1, spd: 210, auto: true, pen: .65, snd: 'g_rifle', scope: [44], sp: [.22, .18, 5.5, 11, .2, 4, 2.8], scopedSpread: .06, rc: RP(.5, 9, .04, 1.5, 7, 1, .2, 43), m: { kind: 'rifle', len: .7, col: 0x7f7a62, fur: 0x3a3a34, mag: 'straight', stock: 'solid', barrel: .18, scope: 1, style: 'sg' } });
defW('aug', { name: 'AUG', slot: 1, cat: 'rifle', team: 'CT', price: 3300, reward: 300, dmg: 28, ap: .9, rm: .98, rpm: 600, mag: 30, res: 90, rl: 3.8, dep: 1.1, spd: 220, auto: true, pen: .65, snd: 'g_m4', scope: [44], sp: [.2, .16, 5.5, 11, .2, 4, 2.8], scopedSpread: .05, rc: RP(.42, 9, .04, 1.3, 7, -1, .2, 45), m: { kind: 'rifle', len: .64, col: 0x4e5b3f, fur: 0x4e5b3f, mag: 'straight', stock: 'none', barrel: .18, bpup: true, scope: 1, style: 'aug' } });
// ---- snipers ----
defW('ssg08', { name: 'SSG 08', slot: 1, cat: 'sniper', team: null, price: 1700, reward: 300, dmg: 88, ap: .85, rm: .99, rpm: 48, mag: 10, res: 90, rl: 3.7, dep: 1.1, spd: 230, bolt: true, pen: .8, snd: 'g_scout', scope: [32, 13], sp: [2.2, 2.0, 6, 1.6, 0, 3, 0], scopedSpread: .04, rc: RP(1.6, 1, 0, 0, 1, 1, .1, 51, 6), m: { kind: 'sniper', len: .8, col: 0x2d3a30, fur: 0x2d3a30, mag: 'straight', stock: 'solid', barrel: .32, scope: 2, style: 'ssg' } });
defW('awp', { name: 'AWP', slot: 1, cat: 'sniper', team: null, price: 4750, reward: 100, dmg: 115, ap: .975, rm: .99, rpm: 41, mag: 5, res: 30, rl: 3.7, dep: 1.25, spd: 200, scopedSpd: 100, bolt: true, pen: 1.3, snd: 'g_awp', scope: [32, 11], sp: [5, 4.5, 9, 12, 0, 3, 0], scopedSpread: .025, rc: RP(2.0, 1, 0, 0, 1, 1, .1, 53, 5), m: { kind: 'sniper', len: .9, col: 0x3d4a2e, fur: 0x3d4a2e, mag: 'box', stock: 'awp', barrel: .38, scope: 3, style: 'awp' } });
// ---- heavy ----
defW('nova', { name: 'Nova', slot: 1, cat: 'shotgun', team: null, price: 1050, reward: 900, dmg: 26, pellets: 9, pSpread: 3.6, ap: .5, rm: .7, rpm: 68, mag: 8, res: 32, rl: .5, shellReload: true, dep: 1.0, spd: 220, pen: .1, snd: 'g_shotgun', sp: [.6, .5, 1.5, 4, 0, 3, 0], rc: RP(2.5, 1, 0, 0, 1, 1, .3, 61, 5), m: { kind: 'shotgun', len: .72, col: 0x2c2d2f, fur: 0x5a3a20, mag: 'tube', stock: 'wood', barrel: .3, pump: true, style: 'nova' } });
defW('xm1014', { name: 'XM1014', slot: 1, cat: 'shotgun', team: null, price: 2000, reward: 900, dmg: 20, pellets: 6, pSpread: 3.9, ap: .8, rm: .7, rpm: 171, mag: 7, res: 32, rl: .45, shellReload: true, dep: 1.0, spd: 215, auto: true, pen: .1, snd: 'g_shotgun', sp: [.6, .5, 1.6, 4, .3, 3, 1], rc: RP(1.8, 3, .3, .6, 3, 1, .3, 63, 6), m: { kind: 'shotgun', len: .74, col: 0x252628, fur: 0x252628, mag: 'tube', stock: 'solid', barrel: .3, style: 'xm' } });
defW('negev', { name: 'Negev', slot: 1, cat: 'mg', team: null, price: 1700, reward: 300, dmg: 35, ap: .71, rm: .97, rpm: 800, mag: 150, res: 300, rl: 5.7, dep: 1.2, spd: 150, auto: true, pen: .6, snd: 'g_mg', sp: [1.1, .9, 5, 11, .05, 3, 1.4], rc: RP(.5, 10, -.01, 1.0, 9, 1, .25, 65), m: { kind: 'mg', len: .8, col: 0x33352f, fur: 0x2b2c28, mag: 'box', stock: 'solid', barrel: .3, style: 'negev' } });
// ---- the rest of the CS2 arsenal ----
defW('p2000', { name: 'P2000', slot: 2, cat: 'pistol', team: 'CT', price: 200, reward: 300, dmg: 35, ap: .505, rm: .91, rpm: 352, mag: 13, res: 52, rl: 2.2, dep: .9, spd: 240, pen: .25, snd: 'g_pistol', sp: [.26, .2, 2.2, 5, .6, 3.5, 3], rc: RP(.7, 3, .2, .5, 5, 1, .12, 6, 10), m: { kind: 'pistol', style: 'p2000' } });
defW('elite', { name: 'Dual Berettas', slot: 2, cat: 'pistol', team: null, price: 300, reward: 300, dmg: 38, ap: .575, rm: .75, rpm: 500, mag: 30, res: 120, rl: 3.8, dep: 1.0, spd: 240, dual: true, pen: .25, snd: 'g_pistol', sp: [.55, .45, 2.5, 5, .5, 3, 3], rc: RP(.6, 4, .2, .8, 5, 1, .15, 8, 10), m: { kind: 'pistol', style: 'elite' } });
defW('cz75a', { name: 'CZ75-Auto', slot: 2, cat: 'pistol', team: null, price: 500, reward: 100, dmg: 31, ap: .7765, rm: .85, rpm: 600, mag: 12, res: 12, rl: 2.7, dep: 1.0, spd: 240, auto: true, pen: .3, snd: 'g_pistol', sp: [.35, .3, 2.3, 5, .35, 3, 3], rc: RP(.45, 6, .1, .9, 5, -1, .15, 12, 9), m: { kind: 'pistol', style: 'cz75' } });
defW('revolver', { name: 'R8 Revolver', slot: 2, cat: 'pistol', team: null, price: 600, reward: 300, dmg: 86, ap: .932, rm: .94, rpm: 120, mag: 8, res: 8, rl: 2.3, dep: 1.0, spd: 220, revolver: true, pen: .5, snd: 'g_heavyp', sp: [.12, .1, 3, 6, 1.5, 3.5, 4], rc: RP(3.0, 1, 0, 0, 1, 1, .3, 14, 4), m: { kind: 'pistol', style: 'r8' } });
defW('mp5sd', { name: 'MP5-SD', slot: 1, cat: 'smg', team: null, price: 1500, reward: 600, dmg: 27, ap: .625, rm: .85, rpm: 750, mag: 30, res: 120, rl: 2.9, dep: 1.0, spd: 235, auto: true, silAlways: true, pen: .2, snd: 'g_smg', sp: [.42, .35, 1.5, 4, .11, 3, 1.9], rc: RP(.28, 10, .05, 1.1, 7, 1, .15, 67), m: { kind: 'smg', style: 'mp5' } });
defW('bizon', { name: 'PP-Bizon', slot: 1, cat: 'smg', team: null, price: 1400, reward: 600, dmg: 27, ap: .575, rm: .8, rpm: 750, mag: 64, res: 120, rl: 2.4, dep: 1.0, spd: 240, auto: true, pen: .2, snd: 'g_smg', sp: [.6, .5, 1.7, 4, .1, 3, 2.1], rc: RP(.25, 12, .04, 1.6, 8, -1, .18, 69), m: { kind: 'smg', style: 'bizon' } });
defW('sawedoff', { name: 'Sawed-Off', slot: 1, cat: 'shotgun', team: 'T', price: 1100, reward: 900, dmg: 32, pellets: 8, pSpread: 5.5, ap: .75, rm: .45, rpm: 71, mag: 7, res: 32, rl: .5, shellReload: true, dep: 1.0, spd: 210, pen: .1, snd: 'g_shotgun', sp: [.6, .5, 1.5, 4, 0, 3, 0], rc: RP(2.8, 1, 0, 0, 1, 1, .3, 71, 5), m: { kind: 'shotgun', style: 'sawedoff' } });
defW('mag7', { name: 'MAG-7', slot: 1, cat: 'shotgun', team: 'CT', price: 1300, reward: 900, dmg: 30, pellets: 8, pSpread: 3.0, ap: .75, rm: .45, rpm: 71, mag: 5, res: 32, rl: 2.4, dep: 1.0, spd: 225, pen: .1, snd: 'g_shotgun', sp: [.55, .45, 1.5, 4, 0, 3, 0], rc: RP(2.6, 1, 0, 0, 1, 1, .3, 72, 5), m: { kind: 'shotgun', style: 'mag7' } });
defW('m249', { name: 'M249', slot: 1, cat: 'mg', team: null, price: 5200, reward: 300, dmg: 32, ap: .8, rm: .97, rpm: 750, mag: 100, res: 200, rl: 5.7, dep: 1.2, spd: 195, auto: true, pen: .6, snd: 'g_mg', sp: [1.0, .8, 5, 11, .06, 3, 1.5], rc: RP(.45, 10, .02, 1.2, 9, -1, .25, 73), m: { kind: 'mg', style: 'm249' } });
defW('g3sg1', { name: 'G3SG1', slot: 1, cat: 'sniper', team: 'T', price: 5000, reward: 300, dmg: 80, ap: .825, rm: .98, rpm: 240, mag: 20, res: 90, rl: 4.7, dep: 1.2, spd: 215, scopedSpd: 120, auto: true, pen: 1.0, snd: 'g_scout', scope: [32, 13], sp: [1.5, 1.3, 7, 10, .3, 3, 2], scopedSpread: .05, rc: RP(1.2, 3, .3, .4, 4, 1, .15, 75, 8), m: { kind: 'sniper', style: 'g3sg1' } });
defW('scar20', { name: 'SCAR-20', slot: 1, cat: 'sniper', team: 'CT', price: 5000, reward: 300, dmg: 80, ap: .825, rm: .98, rpm: 240, mag: 20, res: 90, rl: 3.1, dep: 1.2, spd: 215, scopedSpd: 120, auto: true, pen: 1.0, snd: 'g_scout', scope: [32, 13], sp: [1.5, 1.3, 7, 10, .3, 3, 2], scopedSpread: .05, rc: RP(1.2, 3, .3, .4, 4, -1, .15, 77, 8), m: { kind: 'sniper', style: 'scar20' } });
// ---- melee / special ----
defW('knife', { name: 'Knife', slot: 3, cat: 'knife', team: null, price: 0, reward: 1500, dmg: 40, ap: .85, dep: .85, spd: 250, m: { kind: 'knife' } });
defW('zeus', { name: 'Zeus x27', slot: 3, cat: 'zeus', team: null, price: 200, reward: 100, dmg: 500, ap: 1, range: 4.4, rpm: 30, mag: 1, res: 0, dep: .9, spd: 220, snd: 'zeus', recharge: 30, m: { kind: 'zeus' } });
defW('c4', { name: 'C4 Explosive', slot: 5, cat: 'c4', team: 'T', price: 0, reward: 0, dep: .8, spd: 250, m: { kind: 'c4' } });
// ---- grenades (slot 4) ----
defW('he', { name: 'HE Grenade', slot: 4, cat: 'grenade', gtype: 'he', team: null, price: 300, reward: 300, max: 1, dep: .6, spd: 245, m: { kind: 'grenade', g: 'he' } });
defW('flash', { name: 'Flashbang', slot: 4, cat: 'grenade', gtype: 'flash', team: null, price: 200, reward: 0, max: 2, dep: .6, spd: 245, m: { kind: 'grenade', g: 'flash' } });
defW('smoke', { name: 'Smoke Grenade', slot: 4, cat: 'grenade', gtype: 'smoke', team: null, price: 300, reward: 0, max: 1, dep: .6, spd: 245, m: { kind: 'grenade', g: 'smoke' } });
defW('molotov', { name: 'Molotov', slot: 4, cat: 'grenade', gtype: 'fire', team: 'T', price: 400, reward: 300, max: 1, dep: .6, spd: 245, m: { kind: 'grenade', g: 'molotov' } });
defW('incgrenade', { name: 'Incendiary', slot: 4, cat: 'grenade', gtype: 'fire', team: 'CT', price: 500, reward: 300, max: 1, dep: .6, spd: 245, m: { kind: 'grenade', g: 'inc' } });
defW('decoy', { name: 'Decoy Grenade', slot: 4, cat: 'grenade', gtype: 'decoy', team: null, price: 50, reward: 0, max: 1, dep: .6, spd: 245, m: { kind: 'grenade', g: 'decoy' } });
// ---- equipment (not weapons) ----
const EQUIP = {
  vest: { id: 'vest', name: 'Kevlar Vest', price: 650 },
  vesthelm: { id: 'vesthelm', name: 'Kevlar + Helmet', price: 1000 },
  defuser: { id: 'defuser', name: 'Defuse Kit', price: 400, team: 'CT' }
};
const NADE_ORDER = ['he', 'flash', 'smoke', 'molotov', 'incgrenade', 'decoy'];
const MAX_NADES = 4;

// derived fields + deterministic spray patterns
for (const id in W) {
  const w = W[id];
  w.interval = w.rpm ? 60 / w.rpm : 1;
  w.speed = (w.spd || 250) * U;
  w.hsMul = 4;
  if (w.rc) w.pattern = makePattern(w.mag || 1, w.rc);
}
function makePattern(n, p) {
  const rng = mulberry32(p.seed * 7919); const out = [[0, 0]]; let x = 0, y = 0;
  for (let i = 1; i < Math.max(n, 2); i++) {
    const vy = i < p.rise ? p.kick * (.75 + .5 * (i / p.rise)) : p.kick * p.plat;
    const ph = Math.max(0, i - p.rise + 1);
    const tx = i < p.rise ? p.dir * p.kick * .18 * Math.sin(i * 1.1) : p.dir * p.sway * Math.sin(ph / p.per * Math.PI);
    x = lerp(x, tx, .7) + (rng() - .5) * p.jit; y += vy + (rng() - .5) * p.jit * .3;
    out.push([x, y]);
  }
  return out;
}

/* ---------- buy menu layout (CS2 style columns) ---------- */
const BUY = [
  { name: 'Pistols', T: ['glock', 'elite', 'p250', 'tec9', 'cz75a', 'deagle', 'revolver'], CT: ['usp', 'p2000', 'elite', 'p250', 'fiveseven', 'cz75a', 'deagle', 'revolver'] },
  { name: 'SMGs', T: ['mac10', 'mp7', 'mp5sd', 'ump45', 'p90', 'bizon'], CT: ['mp9', 'mp7', 'mp5sd', 'ump45', 'p90', 'bizon'] },
  { name: 'Heavy', T: ['nova', 'xm1014', 'sawedoff', 'm249', 'negev'], CT: ['nova', 'xm1014', 'mag7', 'm249', 'negev'] },
  { name: 'Rifles', T: ['galil', 'ak47', 'ssg08', 'sg553', 'awp', 'g3sg1'], CT: ['famas', 'm4a4', 'm4a1s', 'ssg08', 'aug', 'awp', 'scar20'] },
  { name: 'Grenades', T: ['flash', 'smoke', 'he', 'molotov', 'decoy'], CT: ['flash', 'smoke', 'he', 'incgrenade', 'decoy'] },
  { name: 'Equipment', T: ['vest', 'vesthelm', 'zeus'], CT: ['vest', 'vesthelm', 'defuser', 'zeus'] }
];
const itemName = id => (W[id] ? W[id].name : EQUIP[id] ? EQUIP[id].name : id);
const itemPrice = id => (W[id] ? W[id].price : EQUIP[id] ? EQUIP[id].price : 0);

/* ---------- skins (all free) ---------- */
const RARITY = ['Consumer', 'Industrial', 'Mil-Spec', 'Restricted', 'Classified', 'Covert', 'Extraordinary'];
const SKINS = [
  { id: 'default', name: 'Factory New', r: 0, type: 'none' },
  { id: 'carbon', name: 'Midnight Carbon', r: 1, type: 'carbon', c: ['#15181c', '#2a2f37'] },
  { id: 'desert', name: 'Desert Digital', r: 1, type: 'digital', c: ['#c8a878', '#9c7c50', '#e0c89a', '#6e5638'] },
  { id: 'jungle', name: 'Jungle Blotch', r: 1, type: 'camo', c: ['#3f4f2c', '#6b7a3e', '#232818', '#8c8a5a'] },
  { id: 'urban', name: 'Urban Slate', r: 2, type: 'digital', c: ['#6f7780', '#474d55', '#9aa3ad', '#2c3036'] },
  { id: 'arctic', name: 'Arctic Frost', r: 2, type: 'camo', c: ['#e6eef4', '#b8c8d6', '#8aa0b4', '#f8fbff'] },
  { id: 'ocean', name: 'Oceanic Drift', r: 2, type: 'wave', c: ['#0e3a5c', '#1f6f9e', '#62b6d8'] },
  { id: 'blaze', name: 'Blaze Stripe', r: 3, type: 'stripes', c: ['#161616', '#e23b1e', '#ffb02e'] },
  { id: 'tiger', name: 'Tiger Claw', r: 3, type: 'tiger', c: ['#e89a2c', '#1a1206'] },
  { id: 'neon', name: 'Neon Circuit', r: 4, type: 'circuit', c: ['#0b0f1a', '#19e6ff', '#ff2bd6'] },
  { id: 'sakura', name: 'Cherry Blossom', r: 4, type: 'floral', c: ['#f7d6e0', '#e87aa0', '#6a2b3f'] },
  { id: 'crimson', name: 'Crimson Weave', r: 5, type: 'web', c: ['#7a0c0c', '#1a0505'] },
  { id: 'hyper', name: 'Hyper Wild', r: 5, type: 'splash', c: ['#1ae0c4', '#ff3b6b', '#1b1030', '#ffe14d'] },
  { id: 'fade', name: 'Sunburst Fade', r: 5, type: 'fade', c: ['#ffcf33', '#ff4f9a', '#7a4dff'] },
  { id: 'gold', name: 'Royal Gold', r: 6, type: 'gold', c: ['#8a6a1c', '#f6d36b', '#fff3c4'] }
];
const SKIN = {}; SKINS.forEach(s => SKIN[s.id] = s);
const KNIVES = [
  { id: 'default', name: 'Standard Knife' }, { id: 'bayonet', name: 'Bayonet' }, { id: 'karambit', name: 'Karambit' },
  { id: 'butterfly', name: 'Butterfly Knife' }, { id: 'flip', name: 'Flip Knife' }, { id: 'bowie', name: 'Bowie Knife' }
];
const Loadout = {
  v: null,
  load() { this.v = Object.assign({ skins: {}, knife: 'default', knifeSkin: 'default' }, Store.get('loadout', {})); if (!this.v.skins) this.v.skins = {}; },
  save() { Store.set('loadout', this.v); },
  skinFor(id) { return id === 'knife' ? this.v.knifeSkin : (this.v.skins[id] || 'default'); }
};
Loadout.load();
