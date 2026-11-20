// Aero Stream - captura direta da placa no Linux (modo jogo), como o Sunshine faz. Criado por Ryan Victtor.
//
// A captura normal do Linux (portal + PipeWire) pede a imagem ao KWin, que monta a tela de novo só para nós e a entrega copiada; com o jogo
// usando a placa toda, o KWin fica sem vez e a transmissão cai para 30 fps. Aqui a imagem vem DIRETO do que está na tela (KMS: o quadro que a
// placa está mostrando) e continua na memória da placa o caminho todo:
//   quadro na tela (DMA-BUF, qualquer formato: 8, 10 ou 16 bits)
//     -> OpenGL da placa (EGL): desenha uma cópia de 8 bits já no tamanho final, numa imagem que o VA-API usa direto
//     -> VA-API: converte para NV12 -> H.264 da placa -> só os bytes já codificados saem
// Nenhum quadro passa pelo processador. O app do PC recebe os quadros codificados pela saída padrão e o Chromium só os empacota na conexão
// WebRTC de sempre (veja app/js/kms.js). (0.7.4) O kmsgrab do ffmpeg não servia: o KWin mostra a tela em 16 bits por cor (AB48) e ele só
// conhece 8 e 10; e com o jogo em tela cheia o formato muda no meio. Aqui cada quadro é importado com o formato que ele tiver.
//
// Ler o quadro da tela exige CAP_SYS_ADMIN (o mesmo do Sunshine). Por isso este programa é instalado uma vez, como administrador, em
// /usr/local/lib/aero-stream/aero-kms (de dono root, ninguém mais pode trocá-lo). Ele não grava arquivos, não abre outros programas e só aceita
// /dev/dri/card* como aparelho.
//
// (0.7.6) UM CODIFICADOR POR PESSOA ("canais"): a tela é lida e convertida uma vez só, e cada pessoa que assiste tem o seu próprio H.264, com
// a sua taxa (a internet dela), o seu tamanho e o seu ritmo. Quem tem internet ruim ou PC fraco recebe menos sem mudar a imagem de ninguém.
// O canal 0 é o da largada (--altura/--fps/--kbps); os outros são abertos e fechados pelo app.
// Saída (stdout), um pacote por quadro:  "AK" | flags (bit 0 = quadro inteiro, bits 4-7 = canal) | tamanho (u32 LE) | captura em µs (u64 LE) | H.264 Annex B
// Entrada (stdin), uma linha por comando: "K [canal]" = próximo quadro inteiro (sem canal: todos) | "B [canal] <kbps>" = nova taxa |
//   "C <canal> <altura> <fps> <kbps>" = abre (ou muda) um canal | "X <canal>" = fecha um canal (o 0 só pausa) | "Q" = sair
// "--teste": em vez da tela, uma imagem de 16 bits (AB48, como a do KWin) desenhada na placa: o mesmo caminho todo, sem permissão (testes)
// Avisos (stderr), uma linha cada: "PRONTO <larg> <alt> <fps>" | "CANAL <canal> <larg> <alt> <fps>" | "TAXA <canal> <kbps>" | "FORMATO <fourcc>" | "ERRO <texto>"
#include <libavcodec/avcodec.h>
#include <libavfilter/avfilter.h>
#include <libavfilter/buffersink.h>
#include <libavfilter/buffersrc.h>
#include <libavutil/hwcontext.h>
#include <libavutil/hwcontext_drm.h>
#include <libavutil/hwcontext_vaapi.h>
#include <libavutil/opt.h>
#include <libavutil/time.h>
#include <sys/resource.h>
#include <drm_fourcc.h>
#include <xf86drm.h>
#include <xf86drmMode.h>
#include <gbm.h>
#include <EGL/egl.h>
#include <EGL/eglext.h>
#include <GLES2/gl2.h>
#include <GLES2/gl2ext.h>
#include <errno.h>
#include <fcntl.h>
#include <poll.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

static int fps = 60, altura = 1080, kbps = 4000, sair = 0, teste = 0;

// um canal = um caminho "imagem da placa -> tamanho do canal (NV12) -> H.264" com a sua taxa e o seu ritmo
#define CANAIS 8
typedef struct {
  int ativo, refazer, alt, fps, kbps;             // o pedido
  int larg, altC, fpsC, kbpsAtual, pedirIdr, acc; // o que está valendo
  int64_t ultimaTroca, n;
  int64_t capt[64];                                // a hora da captura de cada quadro na fila do codificador (pelo número do quadro)
  AVFilterGraph *g; AVFilterContext *src, *sink;
  AVBufferRef *framesEnc; AVCodecContext *enc;
} Canal;
static Canal canais[CANAIS];
static AVBufferRef *rgb = NULL; static int largB = 0, altB = 0; // as imagens de 8 bits no tamanho da captura (o maior de todos os canais)

static void erro(const char *m, int e) {
  char b[128] = "";
  if (e) av_strerror(e, b, sizeof b);
  fprintf(stderr, "ERRO %s %s\n", m, b);
  fflush(stderr);
}

static int escreverTudo(const void *p, size_t n) {
  const uint8_t *c = p;
  while (n) {
    ssize_t w = write(1, c, n);
    if (w < 0) { if (errno == EINTR) continue; return -1; }
    c += w; n -= (size_t)w;
  }
  return 0;
}

// ======================================================================== o quadro da tela (KMS)
typedef struct { int fd[4], n; uint32_t w, h, formato, off[4], pitch[4]; uint64_t mod; int temMod; uint32_t fb; } Quadro;
static int cardFd = -1;
static uint32_t crtcId = 0, planoId = 0;

static uint64_t propriedade(uint32_t obj, uint32_t tipo, const char *nome) {
  uint64_t v = 0;
  drmModeObjectProperties *ps = drmModeObjectGetProperties(cardFd, obj, tipo);
  if (!ps) return 0;
  for (uint32_t i = 0; i < ps->count_props; i++) {
    drmModePropertyRes *p = drmModeGetProperty(cardFd, ps->props[i]);
    if (p && !strcmp(p->name, nome)) v = ps->prop_values[i];
    drmModeFreeProperty(p);
  }
  drmModeFreeObjectProperties(ps);
  return v;
}

// a tela ligada: o CRTC de uma saída conectada e o plano PRINCIPAL dele (o cursor fica em outro plano e não entra)
static int acharTela(void) {
  drmSetClientCap(cardFd, DRM_CLIENT_CAP_UNIVERSAL_PLANES, 1);
  drmModeRes *r = drmModeGetResources(cardFd);
  if (!r) return -1;
  for (int i = 0; i < r->count_connectors && !crtcId; i++) {
    drmModeConnector *c = drmModeGetConnector(cardFd, r->connectors[i]);
    if (c && c->connection == DRM_MODE_CONNECTED && c->encoder_id) {
      drmModeEncoder *e = drmModeGetEncoder(cardFd, c->encoder_id);
      if (e) { crtcId = e->crtc_id; drmModeFreeEncoder(e); }
    }
    drmModeFreeConnector(c);
  }
  for (int i = 0; i < r->count_crtcs && !crtcId; i++) {
    drmModeCrtc *c = drmModeGetCrtc(cardFd, r->crtcs[i]);
    if (c && c->mode_valid && c->buffer_id) crtcId = c->crtc_id;
    drmModeFreeCrtc(c);
  }
  drmModeFreeResources(r);
  if (!crtcId) return -1;
  drmModePlaneRes *pr = drmModeGetPlaneResources(cardFd);
  if (!pr) return -1;
  for (uint32_t i = 0; i < pr->count_planes && !planoId; i++) {
    drmModePlane *p = drmModeGetPlane(cardFd, pr->planes[i]);
    if (p && p->crtc_id == crtcId && propriedade(p->plane_id, DRM_MODE_OBJECT_PLANE, "type") == DRM_PLANE_TYPE_PRIMARY) planoId = p->plane_id;
    drmModeFreePlane(p);
  }
  drmModeFreePlaneResources(pr);
  return planoId ? 0 : -1;
}

static void soltarQuadro(Quadro *q) { for (int i = 0; i < q->n; i++) if (q->fd[i] >= 0) close(q->fd[i]); q->n = 0; }

// o quadro que está na tela agora, como DMA-BUF (sem copiar nada). 0 = ok, 1 = tela desligada, <0 = erro
static int lerTela(Quadro *q) {
  memset(q, 0, sizeof *q);
  drmModePlane *p = drmModeGetPlane(cardFd, planoId);
  if (!p) return -1;
  uint32_t fb = p->fb_id; drmModeFreePlane(p);
  if (!fb) return 1;
  drmModeFB2 *f = drmModeGetFB2(cardFd, fb);
  if (!f) return -1;
  if (!f->handles[0]) { drmModeFreeFB2(f); return -2; } // sem CAP_SYS_ADMIN o kernel não entrega o buffer
  q->w = f->width; q->h = f->height; q->formato = f->pixel_format; q->fb = fb;
  q->temMod = (f->flags & DRM_MODE_FB_MODIFIERS) != 0; q->mod = f->modifier;
  int r = 0;
  for (int i = 0; i < 4 && f->handles[i]; i++) {
    int j; for (j = 0; j < i && f->handles[j] != f->handles[i]; j++) {}
    if (j < i) q->fd[i] = dup(q->fd[j]);
    else if (drmPrimeHandleToFD(cardFd, f->handles[i], DRM_CLOEXEC, &q->fd[i]) < 0) { q->fd[i] = -1; r = -1; }
    q->off[i] = f->offsets[i]; q->pitch[i] = f->pitches[i]; q->n = i + 1;
  }
  for (int i = 0; i < 4 && f->handles[i]; i++) { int j; for (j = 0; j < i && f->handles[j] != f->handles[i]; j++) {} if (j == i) drmCloseBufferHandle(cardFd, f->handles[i]); }
  drmModeFreeFB2(f);
  if (r < 0) soltarQuadro(q);
  return r;
}

// ======================================================================== OpenGL da placa (EGL): converte e muda o tamanho
static EGLDisplay dpy = EGL_NO_DISPLAY;
static EGLContext ctxGl = EGL_NO_CONTEXT;
static PFNEGLCREATEIMAGEKHRPROC criarImagem;
static PFNEGLDESTROYIMAGEKHRPROC apagarImagem;
static PFNGLEGLIMAGETARGETTEXTURE2DOESPROC texDeImagem;
static GLuint prog = 0, texTela = 0;
static struct gbm_device *gbm = NULL;
static int renderFd = -1;

static GLuint compilar(GLenum tipo, const char *src) {
  GLuint s = glCreateShader(tipo); glShaderSource(s, 1, &src, NULL); glCompileShader(s);
  GLint ok = 0; glGetShaderiv(s, GL_COMPILE_STATUS, &ok);
  if (!ok) { char l[512]; glGetShaderInfoLog(s, sizeof l, NULL, l); fprintf(stderr, "ERRO shader %s\n", l); }
  return s;
}

static int iniciarGl(const char *render) {
  renderFd = open(render, O_RDWR | O_CLOEXEC);
  if (renderFd < 0) return -1;
  gbm = gbm_create_device(renderFd);
  PFNEGLGETPLATFORMDISPLAYEXTPROC plat = (PFNEGLGETPLATFORMDISPLAYEXTPROC)eglGetProcAddress("eglGetPlatformDisplayEXT");
  if (!gbm || !plat) return -1;
  dpy = plat(EGL_PLATFORM_GBM_KHR, gbm, NULL);
  if (dpy == EGL_NO_DISPLAY || !eglInitialize(dpy, NULL, NULL) || !eglBindAPI(EGL_OPENGL_ES_API)) return -1;
  // (0.7.8) com um jogo pesado a placa fica com a fila cheia e cada cópia da tela esperava na fila dele: a captura caía de ritmo e quem assiste via em
  // câmera lenta. Como no Sunshine, a nossa cópia (uma fração de milissegundo) passa na frente; se o driver não deixar, segue na prioridade normal
  const EGLint atAlta[] = {EGL_CONTEXT_CLIENT_VERSION, 2, 0x3100 /* EGL_CONTEXT_PRIORITY_LEVEL_IMG */, 0x3101 /* HIGH */, EGL_NONE};
  const EGLint at[] = {EGL_CONTEXT_CLIENT_VERSION, 2, EGL_NONE};
  const char *ext = eglQueryString(dpy, EGL_EXTENSIONS);
  ctxGl = ext && strstr(ext, "EGL_IMG_context_priority") ? eglCreateContext(dpy, EGL_NO_CONFIG_KHR, EGL_NO_CONTEXT, atAlta) : EGL_NO_CONTEXT;
  if (ctxGl == EGL_NO_CONTEXT) ctxGl = eglCreateContext(dpy, EGL_NO_CONFIG_KHR, EGL_NO_CONTEXT, at);
  if (ctxGl == EGL_NO_CONTEXT || !eglMakeCurrent(dpy, EGL_NO_SURFACE, EGL_NO_SURFACE, ctxGl)) return -1;
  criarImagem = (PFNEGLCREATEIMAGEKHRPROC)eglGetProcAddress("eglCreateImageKHR");
  apagarImagem = (PFNEGLDESTROYIMAGEKHRPROC)eglGetProcAddress("eglDestroyImageKHR");
  texDeImagem = (PFNGLEGLIMAGETARGETTEXTURE2DOESPROC)eglGetProcAddress("glEGLImageTargetTexture2DOES");
  if (!criarImagem || !apagarImagem || !texDeImagem) return -1;
  const char *vs = "attribute vec2 p; varying vec2 uv; void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }";
  const char *fs = "#extension GL_OES_EGL_image_external : require\nprecision mediump float; uniform samplerExternalOES t; varying vec2 uv;"
                   "void main() { gl_FragColor = vec4(texture2D(t, uv).rgb, 1.0); }";
  prog = glCreateProgram();
  glAttachShader(prog, compilar(GL_VERTEX_SHADER, vs)); glAttachShader(prog, compilar(GL_FRAGMENT_SHADER, fs));
  glBindAttribLocation(prog, 0, "p"); glLinkProgram(prog);
  GLint ok = 0; glGetProgramiv(prog, GL_LINK_STATUS, &ok);
  if (!ok) return -1;
  glUseProgram(prog); glUniform1i(glGetUniformLocation(prog, "t"), 0);
  glGenTextures(1, &texTela);
  return 0;
}

static EGLImageKHR importar(int n, const int *fd, const uint32_t *off, const uint32_t *pitch, uint32_t w, uint32_t h, uint32_t formato, int temMod, uint64_t mod) {
  EGLint a[64]; int k = 0;
  a[k++] = EGL_WIDTH; a[k++] = (EGLint)w; a[k++] = EGL_HEIGHT; a[k++] = (EGLint)h; a[k++] = EGL_LINUX_DRM_FOURCC_EXT; a[k++] = (EGLint)formato;
  static const EGLint FD[] = {EGL_DMA_BUF_PLANE0_FD_EXT, EGL_DMA_BUF_PLANE1_FD_EXT, EGL_DMA_BUF_PLANE2_FD_EXT, EGL_DMA_BUF_PLANE3_FD_EXT};
  static const EGLint OF[] = {EGL_DMA_BUF_PLANE0_OFFSET_EXT, EGL_DMA_BUF_PLANE1_OFFSET_EXT, EGL_DMA_BUF_PLANE2_OFFSET_EXT, EGL_DMA_BUF_PLANE3_OFFSET_EXT};
  static const EGLint PI[] = {EGL_DMA_BUF_PLANE0_PITCH_EXT, EGL_DMA_BUF_PLANE1_PITCH_EXT, EGL_DMA_BUF_PLANE2_PITCH_EXT, EGL_DMA_BUF_PLANE3_PITCH_EXT};
  static const EGLint ML[] = {EGL_DMA_BUF_PLANE0_MODIFIER_LO_EXT, EGL_DMA_BUF_PLANE1_MODIFIER_LO_EXT, EGL_DMA_BUF_PLANE2_MODIFIER_LO_EXT, EGL_DMA_BUF_PLANE3_MODIFIER_LO_EXT};
  static const EGLint MH[] = {EGL_DMA_BUF_PLANE0_MODIFIER_HI_EXT, EGL_DMA_BUF_PLANE1_MODIFIER_HI_EXT, EGL_DMA_BUF_PLANE2_MODIFIER_HI_EXT, EGL_DMA_BUF_PLANE3_MODIFIER_HI_EXT};
  for (int i = 0; i < n && i < 4; i++) {
    a[k++] = FD[i]; a[k++] = fd[i]; a[k++] = OF[i]; a[k++] = (EGLint)off[i]; a[k++] = PI[i]; a[k++] = (EGLint)pitch[i];
    if (temMod && mod != DRM_FORMAT_MOD_INVALID) { a[k++] = ML[i]; a[k++] = (EGLint)(mod & 0xffffffff); a[k++] = MH[i]; a[k++] = (EGLint)(mod >> 32); }
  }
  a[k++] = EGL_NONE;
  return criarImagem(dpy, EGL_NO_CONTEXT, EGL_LINUX_DMA_BUF_EXT, NULL, a);
}

// cada imagem do VA-API (são poucas, reaproveitadas) vira um alvo de desenho do OpenGL uma vez só
typedef struct { VASurfaceID sup; EGLImageKHR img; GLuint tex, fbo; } Alvo;
static Alvo alvos[16]; static int nAlvos = 0;
static Alvo *alvoDe(AVFrame *vf) {
  VASurfaceID sup = (VASurfaceID)(uintptr_t)vf->data[3];
  for (int i = 0; i < nAlvos; i++) if (alvos[i].sup == sup) return &alvos[i];
  if (nAlvos >= 16) return NULL;
  AVFrame *dm = av_frame_alloc(); dm->format = AV_PIX_FMT_DRM_PRIME;
  if (av_hwframe_map(dm, vf, AV_HWFRAME_MAP_READ | AV_HWFRAME_MAP_WRITE) < 0) { av_frame_free(&dm); return NULL; }
  const AVDRMFrameDescriptor *d = (const AVDRMFrameDescriptor *)dm->data[0];
  const AVDRMLayerDescriptor *l = &d->layers[0];
  int fd[4]; uint32_t off[4], pitch[4];
  for (int i = 0; i < l->nb_planes && i < 4; i++) { fd[i] = d->objects[l->planes[i].object_index].fd; off[i] = (uint32_t)l->planes[i].offset; pitch[i] = (uint32_t)l->planes[i].pitch; }
  uint64_t mod = d->objects[0].format_modifier;
  EGLImageKHR img = importar(l->nb_planes, fd, off, pitch, (uint32_t)vf->width, (uint32_t)vf->height, l->format, mod != DRM_FORMAT_MOD_INVALID, mod);
  av_frame_free(&dm); // o EGL guarda a sua própria referência ao buffer
  if (img == EGL_NO_IMAGE_KHR) { erro("importar a imagem do VA-API no OpenGL", 0); return NULL; }
  Alvo *a = &alvos[nAlvos++];
  a->sup = sup; a->img = img;
  glGenTextures(1, &a->tex); glBindTexture(GL_TEXTURE_2D, a->tex); texDeImagem(GL_TEXTURE_2D, img);
  glGenFramebuffers(1, &a->fbo); glBindFramebuffer(GL_FRAMEBUFFER, a->fbo);
  glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, a->tex, 0);
  if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE) { erro("alvo de desenho incompleto", 0); nAlvos--; return NULL; }
  return a;
}

// desenha o quadro da tela (qualquer formato) na imagem do VA-API, no tamanho de saída. A placa faz tudo; aqui só se espera ela terminar
static int desenhar(const Quadro *q, AVFrame *vf) {
  Alvo *a = alvoDe(vf);
  if (!a) return -1;
  EGLImageKHR img = importar(q->n, q->fd, q->off, q->pitch, q->w, q->h, q->formato, q->temMod, q->mod);
  if (img == EGL_NO_IMAGE_KHR) return -3;
  glBindTexture(GL_TEXTURE_EXTERNAL_OES, texTela); texDeImagem(GL_TEXTURE_EXTERNAL_OES, img);
  glTexParameteri(GL_TEXTURE_EXTERNAL_OES, GL_TEXTURE_MIN_FILTER, GL_LINEAR); glTexParameteri(GL_TEXTURE_EXTERNAL_OES, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
  glBindFramebuffer(GL_FRAMEBUFFER, a->fbo); glViewport(0, 0, vf->width, vf->height);
  static const GLfloat v[] = {-1, -1, 1, -1, -1, 1, 1, 1};
  glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 0, v); glEnableVertexAttribArray(0);
  glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);
  glFinish(); // o VA-API só lê depois que o desenho terminou
  apagarImagem(dpy, img);
  return 0;
}

// ======================================================================== modo de teste: uma "tela" de 16 bits desenhada na placa
static struct gbm_bo *boTeste = NULL; static GLuint fboTeste = 0;
static int lerTeste(Quadro *q, int64_t n) {
  memset(q, 0, sizeof *q);
  if (!boTeste) {
    uint32_t formato = DRM_FORMAT_ABGR16161616;
    boTeste = gbm_bo_create(gbm, 1920, 1080, formato, GBM_BO_USE_RENDERING);
    if (!boTeste) boTeste = gbm_bo_create(gbm, 1920, 1080, DRM_FORMAT_XRGB8888, GBM_BO_USE_RENDERING);
    if (!boTeste) return -1;
  }
  q->w = gbm_bo_get_width(boTeste); q->h = gbm_bo_get_height(boTeste); q->formato = gbm_bo_get_format(boTeste);
  q->mod = gbm_bo_get_modifier(boTeste); q->temMod = q->mod != DRM_FORMAT_MOD_INVALID; q->n = gbm_bo_get_plane_count(boTeste);
  for (int i = 0; i < q->n; i++) { q->fd[i] = gbm_bo_get_fd_for_plane(boTeste, i); q->off[i] = gbm_bo_get_offset(boTeste, i); q->pitch[i] = gbm_bo_get_stride_for_plane(boTeste, i); }
  if (!fboTeste) { // desenha nele pelo próprio OpenGL (cor que muda + um quadrado andando)
    EGLImageKHR img = importar(q->n, q->fd, q->off, q->pitch, q->w, q->h, q->formato, q->temMod, q->mod);
    if (img == EGL_NO_IMAGE_KHR) { soltarQuadro(q); return -1; }
    GLuint t; glGenTextures(1, &t); glBindTexture(GL_TEXTURE_2D, t); texDeImagem(GL_TEXTURE_2D, img);
    glGenFramebuffers(1, &fboTeste); glBindFramebuffer(GL_FRAMEBUFFER, fboTeste); glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, t, 0);
  }
  glBindFramebuffer(GL_FRAMEBUFFER, fboTeste); glViewport(0, 0, (GLsizei)q->w, (GLsizei)q->h);
  glClearColor((float)(n % 120) / 120.f, 0.35f, 0.6f, 1); glClear(GL_COLOR_BUFFER_BIT);
  glEnable(GL_SCISSOR_TEST); glScissor((GLint)((n * 12) % (q->w - 200)), 400, 200, 200); glClearColor(1, 1, 1, 1); glClear(GL_COLOR_BUFFER_BIT); glDisable(GL_SCISSOR_TEST);
  glFinish();
  return 0;
}

// ======================================================================== codificador (VA-API), um por canal
static void fecharCanal(Canal *c) {
  if (c->enc) avcodec_free_context(&c->enc);
  av_buffer_unref(&c->framesEnc);
  avfilter_graph_free(&c->g); c->src = c->sink = NULL;
}

static int abrirCodificador(Canal *c, int id) {
  if (c->enc) avcodec_free_context(&c->enc);
  const AVCodec *cod = avcodec_find_encoder_by_name("h264_vaapi");
  if (!cod) { erro("sem h264_vaapi", 0); return -1; }
  AVCodecContext *e = c->enc = avcodec_alloc_context3(cod);
  e->width = c->larg; e->height = c->altC;
  e->pix_fmt = AV_PIX_FMT_VAAPI;
  e->hw_frames_ctx = av_buffer_ref(c->framesEnc);
  e->time_base = (AVRational){1, c->fpsC};
  e->framerate = (AVRational){c->fpsC, 1};
  e->gop_size = c->fpsC * 30;        // quadro inteiro só quando alguém pede (perda) ou a cada 30 s
  e->max_b_frames = 0;               // sem quadros B: nenhum quadro espera o próximo
  e->bit_rate = (int64_t)c->kbps * 1000;
  e->rc_max_rate = e->bit_rate;
  e->rc_buffer_size = (int)(e->bit_rate * 2 / c->fpsC); // ~2 quadros: o tamanho de cada quadro fica estável (sem picos que a rede segura)
  e->profile = AV_PROFILE_H264_MAIN;
  e->flags |= AV_CODEC_FLAG_LOW_DELAY;
  av_opt_set(e->priv_data, "rc_mode", "CBR", 0);
  av_opt_set_int(e->priv_data, "async_depth", 2, 0); // a placa codifica um quadro enquanto o próximo é capturado (com 1, tudo em fila: só ~36 fps)
  av_opt_set_int(e->priv_data, "aud", 0, 0);
  av_opt_set_int(e->priv_data, "sei", 0, 0);
  int r = avcodec_open2(e, cod, NULL);
  if (r < 0) { erro("abrir o codificador", r); avcodec_free_context(&c->enc); return -1; }
  c->kbpsAtual = c->kbps; c->ultimaTroca = av_gettime_relative(); c->pedirIdr = 1;
  fprintf(stderr, "TAXA %d %d\n", id, c->kbps); fflush(stderr);
  return 0;
}

// monta o caminho do canal: a imagem da captura -> o tamanho do canal (a placa reduz, em NV12) -> codificador
static int montarCanal(Canal *c, int id) {
  fecharCanal(c); c->refazer = 0;
  int alt = c->alt < altB ? c->alt : altB; alt &= ~1;
  int larg = (int)((int64_t)largB * alt / altB) & ~1;
  c->fpsC = c->fps < fps ? c->fps : fps; c->acc = fps; // o 1º quadro já sai
  char args[96];
  if (larg == largB && alt == altB) snprintf(args, sizeof args, "format=nv12:mode=fast");
  else snprintf(args, sizeof args, "w=%d:h=%d:format=nv12:mode=fast", larg, alt);
  int r;
  c->g = avfilter_graph_alloc();
  c->src = avfilter_graph_alloc_filter(c->g, avfilter_get_by_name("buffer"), "in"); // as imagens do VA-API entram antes de iniciar o filtro
  AVBufferSrcParameters *bp = av_buffersrc_parameters_alloc();
  bp->format = AV_PIX_FMT_VAAPI; bp->width = largB; bp->height = altB; bp->time_base = (AVRational){1, fps}; bp->sample_aspect_ratio = (AVRational){1, 1}; bp->hw_frames_ctx = rgb;
  r = c->src ? av_buffersrc_parameters_set(c->src, bp) : AVERROR(ENOMEM); av_free(bp);
  if (r < 0 || (r = avfilter_init_str(c->src, NULL)) < 0) { erro("filtro de entrada", r); fecharCanal(c); return -1; }
  AVFilterContext *conv = NULL;
  if ((r = avfilter_graph_create_filter(&conv, avfilter_get_by_name("scale_vaapi"), "conv", args, NULL, c->g)) < 0 ||
      (r = avfilter_graph_create_filter(&c->sink, avfilter_get_by_name("buffersink"), "out", NULL, NULL, c->g)) < 0 ||
      (r = avfilter_link(c->src, 0, conv, 0)) < 0 || (r = avfilter_link(conv, 0, c->sink, 0)) < 0 || (r = avfilter_graph_config(c->g, NULL)) < 0) { erro("conversão na placa (VA-API)", r); fecharCanal(c); return -1; }
  c->larg = av_buffersink_get_w(c->sink); c->altC = av_buffersink_get_h(c->sink);
  c->framesEnc = av_buffer_ref(av_buffersink_get_hw_frames_ctx(c->sink));
  if (abrirCodificador(c, id) < 0) { fecharCanal(c); return -1; }
  fprintf(stderr, "CANAL %d %d %d %d\n", id, c->larg, c->altC, c->fpsC); fflush(stderr);
  return 0;
}

static int canalValido(int id) { return id >= 0 && id < CANAIS; }
static void lerComandos(void) {
  static char buf[512]; static int n = 0;
  struct pollfd p = {0, POLLIN, 0};
  while (poll(&p, 1, 0) > 0) {
    if (p.revents & (POLLHUP | POLLERR) && !(p.revents & POLLIN)) { sair = 1; return; }
    ssize_t r = read(0, buf + n, sizeof buf - 1 - (size_t)n);
    if (r <= 0) { sair = 1; return; } // o app fechou: sai junto
    n += (int)r; buf[n] = 0;
    char *ini = buf, *fim;
    while ((fim = strchr(ini, '\n'))) {
      *fim = 0;
      int a = 0, b = 0, c = 0, d = 0, k = sscanf(ini + 1, "%d %d %d %d", &a, &b, &c, &d);
      if (ini[0] == 'K') { if (k >= 1) { if (canalValido(a)) canais[a].pedirIdr = 1; } else for (int i = 0; i < CANAIS; i++) canais[i].pedirIdr = 1; }
      else if (ini[0] == 'B') { int id = k >= 2 ? a : 0, v = k >= 2 ? b : a; if (canalValido(id) && v >= 300 && v <= 150000) canais[id].kbps = v; }
      else if (ini[0] == 'C' && k == 4 && canalValido(a) && b >= 144 && b <= 4320 && c >= 10 && c <= 240 && d >= 300 && d <= 150000) {
        Canal *ca = &canais[a];
        if (!ca->ativo || ca->alt != b || ca->fps != c) ca->refazer = 1;
        ca->ativo = 1; ca->alt = b; ca->fps = c; ca->kbps = d;
      }
      else if (ini[0] == 'X' && k >= 1 && canalValido(a)) { canais[a].ativo = 0; fecharCanal(&canais[a]); }
      else if (ini[0] == 'Q') sair = 1;
      ini = fim + 1;
    }
    n = (int)strlen(ini); memmove(buf, ini, (size_t)n + 1);
    if (n > 400) n = 0;
  }
}

// a taxa mudou o bastante? Reabrir custa um quadro inteiro, então: caiu (congestionou) troca logo; subiu, só de 25% para cima a cada 2 s
static void talvezTrocarTaxa(Canal *c, int id) {
  if (c->kbps == c->kbpsAtual) return;
  int64_t agora = av_gettime_relative(), desde = agora - c->ultimaTroca;
  int caiu = c->kbps < c->kbpsAtual * 0.8, subiu = c->kbps > c->kbpsAtual * 1.25;
  if ((caiu && desde > 300000) || (subiu && desde > 2000000)) abrirCodificador(c, id);
}

static int mandar(AVPacket *pk, int64_t capturaUs, int id) {
  uint8_t cab[15] = {'A', 'K', (uint8_t)(((pk->flags & AV_PKT_FLAG_KEY) ? 1 : 0) | (id << 4))};
  uint32_t n = (uint32_t)pk->size; uint64_t t = (uint64_t)capturaUs;
  for (int i = 0; i < 4; i++) cab[3 + i] = (uint8_t)(n >> (8 * i));
  for (int i = 0; i < 8; i++) cab[7 + i] = (uint8_t)(t >> (8 * i));
  if (escreverTudo(cab, sizeof cab) || escreverTudo(pk->data, (size_t)pk->size)) return -1;
  return 0;
}

// a imagem desta captura vai para o canal (se for a vez dele: um canal de 30 fps numa captura de 60 pega um quadro sim, outro não)
static int codificarCanal(Canal *c, int id, AVFrame *vf, AVFrame *fq, AVPacket *saida, int64_t capt) {
  c->acc += c->fpsC;
  if (c->acc < fps) return 0;
  c->acc -= fps;
  if (av_buffersrc_add_frame_flags(c->src, vf, AV_BUFFERSRC_FLAG_KEEP_REF) < 0) return 0;
  while (av_buffersink_get_frame(c->sink, fq) >= 0) {
    talvezTrocarTaxa(c, id);
    if (!c->enc) { av_frame_unref(fq); break; }
    c->capt[c->n & 63] = capt; fq->pts = c->n++;
    if (c->pedirIdr) { fq->pict_type = AV_PICTURE_TYPE_I; fq->flags |= AV_FRAME_FLAG_KEY; c->pedirIdr = 0; } else { fq->pict_type = AV_PICTURE_TYPE_NONE; fq->flags &= ~AV_FRAME_FLAG_KEY; }
    if (avcodec_send_frame(c->enc, fq) < 0) { av_frame_unref(fq); continue; }
    av_frame_unref(fq);
    while (avcodec_receive_packet(c->enc, saida) >= 0) {
      // o pacote que sai pode ser de um quadro anterior (o codificador trabalha alguns na frente): vai com a hora da captura DELE
      int falhou = mandar(saida, saida->pts >= 0 && saida->pts < c->n && c->n - saida->pts < 64 ? c->capt[saida->pts & 63] : capt, id);
      av_packet_unref(saida);
      if (falhou) return -1; // o app fechou a leitura
    }
  }
  return 0;
}

static void esperarAte(int64_t us) { // dorme até o próximo quadro (no relógio do sistema, sem acumular atraso)
  struct timespec t = {(time_t)(us / 1000000), (long)(us % 1000000) * 1000};
  while (clock_nanosleep(CLOCK_MONOTONIC, TIMER_ABSTIME, &t, NULL) == EINTR) {}
}
static int64_t agoraUs(void) { struct timespec t; clock_gettime(CLOCK_MONOTONIC, &t); return (int64_t)t.tv_sec * 1000000 + t.tv_nsec / 1000; }

int main(int argc, char **argv) {
  const char *dispositivo = "/dev/dri/card0";
  for (int i = 1; i < argc; i++) if (!strcmp(argv[i], "--teste")) teste = 1;
  for (int i = 1; i + 1 < argc; i++) {
    if (!strcmp(argv[i], "--aparelho")) dispositivo = argv[++i];
    else if (!strcmp(argv[i], "--fps")) fps = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--altura")) altura = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--kbps")) kbps = atoi(argv[++i]);
  }
  // só aceita a placa (nada de caminhos arbitrários num programa com permissão especial)
  if (teste) dispositivo = "/dev/dri/card0";
  if (strncmp(dispositivo, "/dev/dri/card", 13) || !dispositivo[13] || strspn(dispositivo + 13, "0123456789") != strlen(dispositivo + 13)) { erro("aparelho inválido", 0); return 2; }
  if (fps < 10 || fps > 240) fps = 60;
  if (altura < 360 || altura > 4320) altura = 1080;
  if (kbps < 300 || kbps > 150000) kbps = 4000;
  signal(SIGPIPE, SIG_IGN);
  av_log_set_level(AV_LOG_ERROR);
  setpriority(PRIO_PROCESS, 0, -10); // (0.7.8) o jogo usa todos os núcleos: a captura não pode esperar a vez (sem a permissão, fica como está)
  canais[0] = (Canal){.ativo = 1, .refazer = 1, .alt = altura, .fps = fps, .kbps = kbps};

  // 1) a tela (KMS) e a placa que desenha (o "render node" da MESMA placa)
  char render[64] = "/dev/dri/renderD128";
  if (!teste) {
    cardFd = open(dispositivo, O_RDWR | O_CLOEXEC);
    if (cardFd < 0) { erro("abrir a placa", AVERROR(errno)); return 4; }
    if (acharTela() < 0) { erro("nenhuma tela ligada nesta placa", 0); return 4; }
    char *rn = drmGetRenderDeviceNameFromFd(cardFd);
    if (rn) { snprintf(render, sizeof render, "%s", rn); free(rn); }
  }
  if (iniciarGl(render) < 0) { erro("OpenGL da placa (EGL)", 0); return 5; }
  AVBufferRef *vaDev = NULL;
  int r = av_hwdevice_ctx_create(&vaDev, AV_HWDEVICE_TYPE_VAAPI, render, NULL, 0);
  if (r < 0) { erro("VA-API", r); return 5; }

  AVPacket *saida = av_packet_alloc();
  AVFrame *fq = av_frame_alloc();
  int64_t n = 0, proximo = agoraUs(); uint32_t formatoAnt = 0; int falhas = 0, pronto = 0;

  while (!sair) {
    lerComandos();
    if (sair) break;
    proximo += 1000000 / fps;
    int64_t atraso = agoraUs() - proximo;
    if (atraso > 100000) proximo = agoraUs(); // ficou muito para trás (o PC travou): recomeça o ritmo, sem rajada
    else esperarAte(proximo);
    int64_t capt = av_gettime_relative();
    int algum = 0; for (int i = 0; i < CANAIS; i++) algum |= canais[i].ativo;
    if (!algum) continue; // ninguém assistindo (e sem prévia): nem lê a tela

    Quadro q;
    r = teste ? lerTeste(&q, n) : lerTela(&q);
    if (r == -2) { erro("sem permissão para ler a tela (CAP_SYS_ADMIN)", 0); break; }
    if (r == 1) continue; // tela desligada (proteção de tela): espera ela voltar
    if (r < 0) { if (++falhas > fps * 3) { erro("não consegui ler a tela", 0); break; } continue; }
    if (q.formato != formatoAnt) { formatoAnt = q.formato; fprintf(stderr, "FORMATO %.4s %ux%u\n", (char *)&q.formato, q.w, q.h); fflush(stderr); }
    if (q.w < 320 || q.h < 240) { soltarQuadro(&q); erro("plano errado (não é a tela)", 0); break; }

    // 2) na primeira imagem: as imagens do VA-API (8 bits, no tamanho da captura), de onde cada canal tira o seu tamanho
    if (!rgb) {
      altB = (int)q.h > altura ? altura : (int)q.h;
      largB = (int)((int64_t)q.w * altB / q.h) & ~1; altB &= ~1;
      rgb = av_hwframe_ctx_alloc(vaDev);
      AVHWFramesContext *fc = (AVHWFramesContext *)rgb->data;
      fc->format = AV_PIX_FMT_VAAPI; fc->sw_format = AV_PIX_FMT_BGR0; fc->width = largB; fc->height = altB; fc->initial_pool_size = 8;
      if ((r = av_hwframe_ctx_init(rgb)) < 0) { erro("imagens do VA-API", r); soltarQuadro(&q); break; }
    }
    for (int i = 0; i < CANAIS; i++) if (canais[i].ativo && canais[i].refazer && montarCanal(&canais[i], i) < 0) { canais[i].ativo = 0; if (i == 0 && !pronto) break; }
    if (!pronto) {
      if (!canais[0].enc) { soltarQuadro(&q); break; }
      pronto = 1; fprintf(stderr, "PRONTO %d %d %d\n", canais[0].larg, canais[0].altC, canais[0].fpsC); fflush(stderr);
    }

    // 3) desenha o quadro da tela numa imagem do VA-API (8 bits, no tamanho da captura) e manda para cada canal
    AVFrame *vf = av_frame_alloc();
    if (av_hwframe_get_buffer(rgb, vf, 0) < 0) { av_frame_free(&vf); soltarQuadro(&q); continue; }
    r = desenhar(&q, vf);
    soltarQuadro(&q);
    if (r < 0) {
      av_frame_free(&vf);
      if (r == -3) { erro("a placa não importou o formato da tela", 0); fprintf(stderr, "ERRO formato %.4s\n", (char *)&formatoAnt); }
      if (++falhas > fps * 3) { erro("não consegui converter a tela", 0); break; }
      continue;
    }
    falhas = 0;
    vf->pts = n++;
    for (int i = 0; i < CANAIS && !sair; i++) if (canais[i].ativo && canais[i].enc && codificarCanal(&canais[i], i, vf, fq, saida, capt) < 0) sair = 1;
    av_frame_free(&vf);
  }
  for (int i = 0; i < CANAIS; i++) fecharCanal(&canais[i]);
  av_buffer_unref(&rgb);
  av_buffer_unref(&vaDev);
  av_frame_free(&fq); av_packet_free(&saida);
  return 0;
}
