// Aero Stream - ponte da janela dos cursores globais: só recebe a lista de cursores (nada mais é exposto). Criado por Ryan Victtor.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('aeroCursores', (cb) => { ipcRenderer.on('cursores', (_e, l) => { try { cb(Array.isArray(l) ? l : []); } catch (e) { /* ok */ } }); });
