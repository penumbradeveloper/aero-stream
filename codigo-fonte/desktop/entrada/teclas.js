// Aero Stream - tabela de teclas: nome da tecla na web (KeyboardEvent.code) -> [código do Linux (evdev), scancode do Windows, estendida?].
// Nas teclas comuns os dois números são iguais; nas "estendidas" (setas, Home, Ctrl direito...) o Windows usa o prefixo E0.
// Criado por Ryan Victtor.
'use strict';
const T = Object.create(null);
const t = (code, evdev, scan = evdev, ext = 0) => { T[code] = [evdev, scan, ext]; };

for (const [c, n] of Object.entries({ KeyQ: 16, KeyW: 17, KeyE: 18, KeyR: 19, KeyT: 20, KeyY: 21, KeyU: 22, KeyI: 23, KeyO: 24, KeyP: 25, KeyA: 30, KeyS: 31, KeyD: 32, KeyF: 33, KeyG: 34, KeyH: 35, KeyJ: 36, KeyK: 37, KeyL: 38, KeyZ: 44, KeyX: 45, KeyC: 46, KeyV: 47, KeyB: 48, KeyN: 49, KeyM: 50 })) t(c, n);
for (let i = 1; i <= 9; i++) t('Digit' + i, 1 + i);
t('Digit0', 11);
for (const [c, n] of Object.entries({
  Escape: 1, Minus: 12, Equal: 13, Backspace: 14, Tab: 15, BracketLeft: 26, BracketRight: 27, Enter: 28, ControlLeft: 29, Semicolon: 39, Quote: 40, Backquote: 41,
  ShiftLeft: 42, Backslash: 43, Comma: 51, Period: 52, Slash: 53, ShiftRight: 54, NumpadMultiply: 55, AltLeft: 56, Space: 57, CapsLock: 58, NumLock: 69, ScrollLock: 70,
  Numpad7: 71, Numpad8: 72, Numpad9: 73, NumpadSubtract: 74, Numpad4: 75, Numpad5: 76, Numpad6: 77, NumpadAdd: 78, Numpad1: 79, Numpad2: 80, Numpad3: 81, Numpad0: 82,
  NumpadDecimal: 83, IntlBackslash: 86, F11: 87, F12: 88,
})) t(c, n);
for (let i = 1; i <= 10; i++) t('F' + i, 58 + i);
// estendidas: [evdev, scancode do Windows, 1]
t('NumpadEnter', 96, 0x1c, 1); t('ControlRight', 97, 0x1d, 1); t('NumpadDivide', 98, 0x35, 1); t('PrintScreen', 99, 0x37, 1); t('AltRight', 100, 0x38, 1);
t('Home', 102, 0x47, 1); t('ArrowUp', 103, 0x48, 1); t('PageUp', 104, 0x49, 1); t('ArrowLeft', 105, 0x4b, 1); t('ArrowRight', 106, 0x4d, 1);
t('End', 107, 0x4f, 1); t('ArrowDown', 108, 0x50, 1); t('PageDown', 109, 0x51, 1); t('Insert', 110, 0x52, 1); t('Delete', 111, 0x53, 1);
t('MetaLeft', 125, 0x5b, 1); t('MetaRight', 126, 0x5c, 1); t('ContextMenu', 127, 0x5d, 1);
t('Pause', 119, 0, 0); // no Windows o Pause é enviado como tecla virtual (VK_PAUSE = 0x13)

module.exports = { TECLAS: T, buscar: (code) => T[code] || null };
