/* SPDX-License-Identifier: Apache-2.0 */
OUTPUT_FORMAT(elf32-i386)
ENTRY(_start)
SECTIONS {
  . = 0x100;
  .text : { *(.start) *(.text*) }
  .rodata : { *(.rodata*) }
  .data : { *(.data*) }
  __bss_start = .;
  .bss (NOLOAD) : { *(.bss*) *(COMMON) }
  __bss_end = .;
  ASSERT(__bss_end < 0xe000, "DOS code/data exceed segment: reserve 8K stack")
  /DISCARD/ : { *(.eh_frame*) *(.comment*) *(.note*) }
}
