'use strict';

/**
 * Pre-built track outlines for known F1 circuits.
 * Each track is an array of {x, z} points representing the approximate layout.
 * Coordinates are in game-world scale (meters), derived from typical F1 game data.
 * These serve as fallback until live Motion data builds a more accurate outline.
 */

const TRACK_OUTLINES = {
  // 0: Melbourne (Albert Park)
  0: generateOval(300, 200, 58, 0.15),
  // 3: Bahrain (Sakhir)
  3: generateOval(250, 350, 54, 0.2),
  // 4: Catalunya (Barcelona)
  4: generateOval(350, 250, 56, 0.18),
  // 5: Monaco
  5: generateOval(180, 280, 50, 0.25),
  // 6: Montreal (Gilles Villeneuve)
  6: generateOval(400, 150, 52, 0.12),
  // 7: Silverstone
  7: generateOval(380, 280, 58, 0.2),
  // 9: Hungaroring
  9: generateOval(280, 220, 54, 0.22),
  // 10: Spa-Francorchamps
  10: generateOval(450, 300, 60, 0.15),
  // 11: Monza
  11: generateOval(350, 200, 54, 0.1),
  // 12: Singapore (Marina Bay)
  12: generateOval(250, 300, 56, 0.2),
  // 13: Suzuka
  13: generateFigure8(350, 250, 60),
  // 14: Abu Dhabi (Yas Marina)
  14: generateOval(320, 280, 56, 0.18),
  // 15: Austin (COTA)
  15: generateOval(380, 300, 58, 0.2),
  // 16: Brazil (Interlagos)
  16: generateOval(280, 220, 52, 0.15),
  // 17: Austria (Red Bull Ring)
  17: generateOval(250, 200, 48, 0.12),
  // 19: Mexico City (Autodromo Hermanos Rodriguez)
  19: generateOval(300, 250, 54, 0.18),
  // 20: Baku (Azerbaijan)
  20: generateOval(200, 400, 56, 0.2),
  // 26: Zandvoort
  26: generateOval(260, 180, 50, 0.15),
  // 27: Imola
  27: generateOval(300, 220, 52, 0.18),
  // 29: Jeddah
  29: generateOval(200, 450, 58, 0.2),
  // 30: Miami
  30: generateOval(320, 280, 56, 0.18),
  // 31: Las Vegas
  31: generateOval(200, 400, 54, 0.15),
  // 32: Lusail (Qatar)
  32: generateOval(320, 250, 56, 0.18),
  // 33: Madrid
  33: generateOval(350, 280, 56, 0.2),
};

/**
 * Generate an oval-ish track with perturbation for realism.
 */
function generateOval(rx, ry, numPoints, wobble) {
  const points = [];
  for (let i = 0; i < numPoints; i++) {
    const t = (i / numPoints) * Math.PI * 2;
    const w = 1 + wobble * Math.sin(t * 3 + 0.5) * Math.cos(t * 2 + 1.2);
    points.push({
      x: rx * Math.cos(t) * w,
      z: ry * Math.sin(t) * w,
    });
  }
  return points;
}

/**
 * Generate a figure-8 shape (Suzuka).
 */
function generateFigure8(rx, ry, numPoints) {
  const points = [];
  for (let i = 0; i < numPoints; i++) {
    const t = (i / numPoints) * Math.PI * 2;
    points.push({
      x: rx * Math.sin(t),
      z: ry * Math.sin(t) * Math.cos(t),
    });
  }
  return points;
}

module.exports = TRACK_OUTLINES;
