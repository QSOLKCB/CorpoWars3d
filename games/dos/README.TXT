CORPO WARS: DIVIDEND ZERO -- DOS DEMAKE
QSOL-IMC / Trent Slade. Apache-2.0. Original code, art and music.

Extract the full ZIP into a folder. From THAT folder on your host, run:
  dosbox -conf DOSBOX.CONF
Or mount that folder in DOSBox, change to its drive and run CORPO.COM.
Keep MENU.MOD, ACTION.MOD and BOSS.MOD beside CORPO.COM.

386 or newer, VGA, DOS, 640K conventional memory recommended.
Sound: Sound Blaster 16, 11025 Hz signed 16-bit mono DMA. Four MOD channels.
BLASTER supports A210-A280, IRQ 5/7 and high DMA 5/6/7. Other cards run silent.
DOSBox config uses A220 I5 D1 H5 T6. Physical hardware is not validated.

ARROWS / A,D: run       SPACE / W / UP: jump
CTRL / X: fire         1-4 / Q: switch living agent
F: squad follow        H: squad hold
E: hold at relay       Z: panic stun (15 second cooldown)
P: pause               M: mute music/effects
ENTER: start/retry      ESC: return to DOS

Three districts. Breach the relay, defeat the warden, reach the EXIT.
Squadmates keep their own health and follow or hold while firing autonomously.
Jump gaps; medical caches restore health. Infinite ammunition.
Panic stuns nearby guards briefly; it does not kill them or heal agents.

MOD files use Amiga-compatible signed 8-bit instrument samples. The game
and output mixer are 16-bit. Player supports notes, Cxx volume and Fxx
speed/tempo; it is intentionally not a general-purpose ProTracker player.
All samples are mathematical waveforms/noise. E8 root walks choose melodies.
No recordings, ripped game assets, external engine or DOS extender.

Source, reproducible build and validation:
https://github.com/QSOLKCB/CorpoWars3d/tree/main/games/dos
