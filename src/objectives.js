// SPDX-License-Identifier: Apache-2.0
// Adapted from CorpoWars 289ba40 src/objectives.js: keep the original contract
// mechanics, then secure every district control node in displayed order.
// Escort contracts capture control nodes before the witness is released.
export function captureKeys(game) { return game.mission.kind==='escort' ? ['relay', ...(game.captureKeys ?? []), 'vault'] : ['relay', 'vault', ...(game.captureKeys ?? [])]; }
export function objectiveKeys(game) { return [...captureKeys(game), 'exit']; }
export function capturesComplete(game) { return captureKeys(game).every(key => game[key].done); }
export function currentObjectiveKey(game) { return captureKeys(game).find(key => !game[key].done) ?? 'exit'; }
export function objectiveLabel(game, key) {
  return key === 'relay' ? game.mission.labels[0] : key === 'vault' ? game.mission.labels[1] : key === 'exit' ? 'EXTRACTION' : game[key].label;
}
