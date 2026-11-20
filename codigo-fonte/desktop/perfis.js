// Aero Stream - "perfis" de configuração do Chromium para a PLACA DE VÍDEO codificar no Linux. Criado por Ryan Victtor.
//
// O Chromium só usa o codificador H.264 da placa (VA-API) se várias peças se encaixarem: o recurso de codificação ligado, o driver aceito,
// o processo da GPU conseguindo abrir o driver dentro do "sandbox" e o jeito de desenhar (GL/Vulkan, Wayland/X11). Cada computador
// precisa de uma combinação. Em vez de adivinhar, o app TESTA as combinações abaixo (cada teste é uma cópia escondida do próprio app,
// que pergunta ao Chromium e codifica alguns quadros de verdade) e fica com a primeira em que a PLACA codificou.
//
// Em NENHUM perfil a DECODIFICAÇÃO por hardware fica ligada (era ela que travava o driver nas versões 0.4.0/0.4.1).
'use strict';

const DECODIFICACAO = ['AcceleratedVideoDecodeLinuxGL', 'AcceleratedVideoDecodeLinuxZeroCopyGL', 'VaapiVideoDecodeLinuxGL', 'VaapiVideoDecoder', 'AcceleratedVideoDecoder', 'UseChromeOSDirectVideoDecoder'];
const CODIFICACAO = ['AcceleratedVideoEncoder', 'VaapiVideoEncoder', 'VaapiIgnoreDriverChecks'];

// do mais simples (menos mudanças) ao mais "forte"
const PERFIS = [
  { id: 'padrao', nome: 'VA-API só para codificar', ligar: [], chaves: [] },
  { id: 'semdecod', nome: 'VA-API só para codificar, decodificação desligada também no processo da GPU', ligar: [], chaves: [['disable-accelerated-video-decode']] },
  { id: 'vulkan', nome: 'VA-API + Vulkan (ANGLE)', ligar: ['Vulkan', 'DefaultANGLEVulkan', 'VulkanFromANGLE'], chaves: [['use-angle', 'vulkan']] },
  { id: 'x11', nome: 'VA-API pelo XWayland (X11)', ligar: [], chaves: [['ozone-platform', 'x11']] },
  { id: 'semsandbox', nome: 'VA-API com o processo da GPU fora do sandbox', ligar: [], chaves: [['disable-gpu-sandbox']] },
  { id: 'x11-semsandbox', nome: 'VA-API pelo XWayland, processo da GPU fora do sandbox', ligar: [], chaves: [['ozone-platform', 'x11'], ['disable-gpu-sandbox']] },
];
const perfil = (id) => PERFIS.find((p) => p.id === id) || PERFIS[0];

// Flags para um perfil: { ligar: [...features], desligar: [...features], chaves: [[switch, valor?], ...] }
function montar(id) {
  const p = perfil(id);
  return { id: p.id, ligar: [...CODIFICACAO, ...p.ligar], desligar: [...DECODIFICACAO], chaves: [['ignore-gpu-blocklist'], ...p.chaves] };
}

// Quem codificou? (nome que o Chromium dá ao codificador nas estatísticas do WebRTC / resultado do WebCodecs)
const ehPlaca = (impl) => /Vaapi|VAAPI|VideoEncodeAccelerator|ExternalEncoder|MediaFoundation|NVENC|AMF|V4L2/i.test(String(impl || '')) && !/OpenH264|libvpx|SimulcastEncoderAdapter \(libvpx/i.test(String(impl || ''));

// Escolhe o perfil a partir dos resultados dos testes: o primeiro (na ordem acima) em que a PLACA codificou de verdade.
function escolher(resultados) {
  for (const p of PERFIS) {
    const r = (resultados || []).find((x) => x && x.id === p.id);
    if (r && r.ok && r.placa) return p.id;
  }
  return null;
}

module.exports = { PERFIS, perfil, montar, escolher, ehPlaca, DECODIFICACAO, CODIFICACAO };
