/* SPDX-License-Identifier: Apache-2.0 */
.code16gcc
.section .start,"ax"
.global _start
_start:
    cli
    movw %cs,%ax
    movw %ax,%ds
    movw %ax,%es
    movw %ax,%ss
    movl $0xfffc,%esp
    cld
    movl $__bss_start,%edi
    movl $__bss_end,%ecx
    subl %edi,%ecx
    xorl %eax,%eax
    rep stosb
    sti
    /* DOS gives COM all available memory. Retain one 64K segment. */
    movw $0x4a00,%ax
    movw $0x1000,%bx
    int $0x21
    jc memory_error
    call main
    movw $0x4c00,%ax
    int $0x21
memory_error:
    movw $0x4c01,%ax
    int $0x21

.text
.global timer_isr,keyboard_isr,sound_isr
.global old_timer,old_keyboard,old_sound
.extern timer_ticks,keys,audio_irq
timer_isr:
    pushal
    pushw %ds
    pushw %es
    movw %cs,%ax
    movw %ax,%ds
    cld
    incl timer_ticks
    addw $17045,timer_fraction
    jc timer_chain
    movb $0x20,%al
    outb %al,$0x20
    popw %es
    popw %ds
    popal
    iretw
timer_chain:
    popw %es
    popw %ds
    popal
    ljmpw *%cs:old_timer
keyboard_isr:
    pushal
    pushw %ds
    movw %cs,%ax
    movw %ax,%ds
    cld
    xorl %eax,%eax
    inb $0x60,%al
    cmpb $0xe0,%al
    jae key_ack
    movl %eax,%ebx
    andl $127,%ebx
    testb $128,%al
    setz keys(%ebx)
key_ack:
    inb $0x61,%al
    movb %al,%ah
    orb $128,%al
    outb %al,$0x61
    movb %ah,%al
    outb %al,$0x61
    movb $0x20,%al
    outb %al,$0x20
    popw %ds
    popal
    iretw
sound_isr:
    pushal
    pushw %ds
    pushw %es
    movw %cs,%ax
    movw %ax,%ds
    cld
    call audio_irq
    testl %eax,%eax
    jz sound_chain
    popw %es
    popw %ds
    popal
    iretw
sound_chain:
    popw %es
    popw %ds
    popal
    ljmpw *%cs:old_sound
.data
old_timer: .long 0
old_keyboard: .long 0
old_sound: .long 0
timer_fraction: .word 0
.section .note.GNU-stack,"",@progbits
