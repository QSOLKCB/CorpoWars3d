// SPDX-License-Identifier: Apache-2.0
// Closed-form constant-acceleration vertical motion; no ambient clock.
export const GRAVITY=11;
export const JUMP_IMPULSE=4.3;
export function ballisticStep(elevation,velocity,dt){
  if(![elevation,velocity,dt].every(Number.isFinite)||elevation<0||dt<0||dt>.1)throw new RangeError('invalid ballistic state');
  if(elevation===0&&velocity<=0)return {elevation:0,velocity:0};
  const next=elevation+velocity*dt-.5*GRAVITY*dt*dt;
  return next<=0?{elevation:0,velocity:0}:{elevation:next,velocity:velocity-GRAVITY*dt};
}
