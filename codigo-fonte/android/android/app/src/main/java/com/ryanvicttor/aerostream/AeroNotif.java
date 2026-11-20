package com.ryanvicttor.aerostream;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Shader;
import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.media.MediaScannerConnection;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import android.os.Build;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.drawable.IconCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

// (0.8.6) notificações de mensagem do Aero no celular, como as do Discord: a foto e o nome de quem mandou e o texto. As mensagens da mesma
// pessoa se empilham numa notificação só (a mais nova embaixo); cada pessoa diferente ganha a dela. Tocar abre a conversa.
@CapacitorPlugin(name = "AeroNotif")
public class AeroNotif extends Plugin {
    private static final String CANAL = AeroPushJob.CANAL;
    private static final String GRUPO = "aero-mensagens";
    private static final int RESUMO = 1;
    private static final Map<String, ArrayList<String[]>> pilhas = new HashMap<>();
    private static final Map<String, Bitmap> fotos = new HashMap<>();
    static volatile boolean naTela = false;

    @Override
    protected void handleOnResume() {
        super.handleOnResume(); naTela = true;
        getContext().getSharedPreferences(AeroPushJob.PREFS, Context.MODE_PRIVATE).edit().putLong("fundo", 0).apply();
        AeroPushAlarme.cancelar(getContext());
        AeroPushJob.avisarFundo(getContext(), false);
    }

    // (0.9.2) saiu do app: começa a perguntar ao servidor por mensagem nova (o app no fundo é congelado pelo Android logo depois)
    @Override
    protected void handleOnPause() {
        super.handleOnPause(); naTela = false;
        getContext().getSharedPreferences(AeroPushJob.PREFS, Context.MODE_PRIVATE).edit().putLong("fundo", System.currentTimeMillis()).apply();
        AeroPushAlarme.agendar(getContext());
        AeroPushJob.avisarFundo(getContext(), true);
    }

    // (0.9.1) tela cheia de verdade na tela compartilhada: some a barra de status e a de navegação (voltam puxando da borda), a imagem usa
    // até a área do recorte da câmera e, se a tela de quem compartilha for deitada, o celular gira sozinho
    @PluginMethod
    public void telaCheia(PluginCall call) {
        final boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        final boolean deitar = Boolean.TRUE.equals(call.getBoolean("paisagem", false));
        call.resolve();
        if (getActivity() == null) return;
        getActivity().runOnUiThread(() -> {
            try {
                Window w = getActivity().getWindow();
                WindowInsetsControllerCompat c = WindowCompat.getInsetsController(w, w.getDecorView());
                WindowManager.LayoutParams lp = w.getAttributes();
                if (on) {
                    c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                    c.hide(WindowInsetsCompat.Type.systemBars());
                    if (Build.VERSION.SDK_INT >= 28) lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
                    if (deitar) getActivity().setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
                } else {
                    c.show(WindowInsetsCompat.Type.systemBars());
                    if (Build.VERSION.SDK_INT >= 28) lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT;
                    getActivity().setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
                }
                w.setAttributes(lp);
            } catch (Exception e) { /* fica a tela cheia só dentro do app */ }
        });
    }

    // (0.9.1) push com o app fechado: guarda o token de push deste aparelho e agenda a checagem em segundo plano (AeroPushJob)
    @PluginMethod
    public void guardarPush(PluginCall call) {
        String t = call.getString("t", ""), api = call.getString("api", "");
        if (t == null || !t.matches("[A-Za-z0-9]{40}") || api == null || !api.startsWith("https://")) { call.reject("inválido"); return; }
        getContext().getSharedPreferences(AeroPushJob.PREFS, Context.MODE_PRIVATE).edit().putString("t", t).putString("api", api).apply();
        AeroPushJob.agendar(getContext());
        if (!naTela) AeroPushAlarme.agendar(getContext());
        call.resolve();
    }

    @PluginMethod
    public void limparPush(PluginCall call) {
        getContext().getSharedPreferences(AeroPushJob.PREFS, Context.MODE_PRIVATE).edit().clear().apply();
        AeroPushJob.cancelar(getContext());
        call.resolve();
    }

    // O player do Spotify fica num iframe: só o embed carrega dentro do app, e fora da lista "allowNavigation" ele não recebe a
    // ponte nativa (plugins). Os demais links do Spotify seguem o caminho normal (abrem fora).
    @Override
    public Boolean shouldOverrideLoad(Uri url) {
        if (url != null && "https".equals(url.getScheme()) && "open.spotify.com".equals(url.getHost())) {
            String p = url.getPath();
            if (p != null && p.startsWith("/embed/")) return false;
        }
        return null;
    }

    @Override
    public void load() {
        criarCanal();
        naTela = true;
        avisarClique(getActivity() != null ? getActivity().getIntent() : null);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        avisarClique(intent);
    }

    private void avisarClique(Intent intent) {
        if (intent == null) return;
        String cid = intent.getStringExtra("aeroCid");
        if (cid == null) return;
        intent.removeExtra("aeroCid");
        JSObject d = new JSObject();
        d.put("cid", cid);
        notifyListeners("clique", d, true);
    }

    private void criarCanal() { criarCanal(getContext()); }

    // (0.9.2) o canal antigo nascia sem vibração em alguns celulares: este já vem com vibração, som e luz
    static void criarCanal(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        try { if (nm.getNotificationChannel("aero-mensagens") != null) nm.deleteNotificationChannel("aero-mensagens"); } catch (Exception e) { /* ok */ }
        if (nm.getNotificationChannel(CANAL) != null) return;
        NotificationChannel c = new NotificationChannel(CANAL, "Mensagens", NotificationManager.IMPORTANCE_HIGH);
        c.setDescription("Mensagens do Aero Talk");
        c.enableVibration(true);
        c.setVibrationPattern(new long[] { 0, 250, 120, 250 });
        c.enableLights(true);
        c.setLockscreenVisibility(android.app.Notification.VISIBILITY_PRIVATE);
        nm.createNotificationChannel(c);
    }

    private boolean pode() {
        return Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    @PluginMethod
    public void permitir(PluginCall call) {
        if (!pode() && getActivity() != null && Build.VERSION.SDK_INT >= 33) {
            ActivityCompat.requestPermissions(getActivity(), new String[] { Manifest.permission.POST_NOTIFICATIONS }, 7061);
        }
        JSObject r = new JSObject();
        r.put("ok", pode());
        call.resolve(r);
    }

    @PluginMethod
    public void mostrar(PluginCall call) {
        final String grupo = call.getString("grupo", "aero");
        final String nome = call.getString("nome", "Aero");
        final String titulo = call.getString("titulo", nome);
        final String texto = call.getString("texto", "");
        final String icone = call.getString("icone", "");
        final String cid = call.getString("cid", "");
        call.resolve();
        new Thread(() -> {
            try {
                Bitmap foto = fotoDe(icone);
                synchronized (pilhas) {
                    ArrayList<String[]> l = pilhas.get(grupo);
                    if (l == null) { l = new ArrayList<>(); pilhas.put(grupo, l); }
                    l.add(new String[] { texto, String.valueOf(System.currentTimeMillis()) });
                    while (l.size() > 8) l.remove(0);
                    publicar(grupo, nome, titulo, foto, cid, new ArrayList<>(l));
                }
            } catch (Exception e) { /* sem notificação: o aviso dentro do app já apareceu */ }
        }).start();
    }

    @PluginMethod
    public void limpar(PluginCall call) {
        String grupo = call.getString("grupo", "");
        NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        synchronized (pilhas) {
            if (grupo == null || grupo.isEmpty()) {
                pilhas.clear();
                if (nm != null) nm.cancelAll();
            } else {
                pilhas.remove(grupo);
                if (nm != null) { nm.cancel(grupo.hashCode()); if (pilhas.isEmpty()) nm.cancel(RESUMO); }
            }
        }
        call.resolve();
    }

    private Bitmap fotoDe(String url) {
        if (url == null || !url.startsWith("https://")) return null;
        synchronized (fotos) { if (fotos.containsKey(url)) return fotos.get(url); }
        Bitmap b = null;
        try {
            HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
            con.setConnectTimeout(4000);
            con.setReadTimeout(5000);
            try (InputStream in = con.getInputStream()) { b = BitmapFactory.decodeStream(in); }
            con.disconnect();
            if (b != null) b = redonda(b);
        } catch (Exception e) { b = null; }
        synchronized (fotos) { if (fotos.size() > 40) fotos.clear(); fotos.put(url, b); }
        return b;
    }

    private static Bitmap redonda(Bitmap src) {
        int t = Math.min(256, Math.min(src.getWidth(), src.getHeight()));
        Bitmap q = Bitmap.createScaledBitmap(src, t, t, true);
        Bitmap out = Bitmap.createBitmap(t, t, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(out);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setShader(new BitmapShader(q, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP));
        c.drawCircle(t / 2f, t / 2f, t / 2f, p);
        return out;
    }

    private void publicar(String grupo, String nome, String titulo, Bitmap foto, String cid, ArrayList<String[]> msgs) {
        if (!pode()) return;
        Context ctx = getContext();
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        Person.Builder pb = new Person.Builder().setName(nome).setKey(grupo);
        if (foto != null) pb.setIcon(IconCompat.createWithBitmap(foto));
        Person quem = pb.build();
        NotificationCompat.MessagingStyle estilo = new NotificationCompat.MessagingStyle(new Person.Builder().setName("Você").build());
        if (!titulo.equals(nome)) { estilo.setConversationTitle(titulo); estilo.setGroupConversation(true); }
        for (String[] m : msgs) estilo.addMessage(m[0], Long.parseLong(m[1]), quem);
        Intent abrir = new Intent(ctx, MainActivity.class);
        abrir.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        abrir.putExtra("aeroCid", cid);
        int id = grupo.hashCode();
        PendingIntent pi = PendingIntent.getActivity(ctx, id, abrir, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder n = new NotificationCompat.Builder(ctx, CANAL)
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentTitle(titulo)
            .setContentText(msgs.get(msgs.size() - 1)[0])
            .setStyle(estilo)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .setGroup(GRUPO)
            .setContentIntent(pi);
        if (foto != null) n.setLargeIcon(foto);
        nm.notify(id, n.build());
        if (pilhas.size() > 1) {
            NotificationCompat.Builder r = new NotificationCompat.Builder(ctx, CANAL)
                .setSmallIcon(android.R.drawable.stat_notify_chat)
                .setContentTitle("Aero")
                .setGroup(GRUPO)
                .setGroupSummary(true)
                .setGroupAlertBehavior(NotificationCompat.GROUP_ALERT_CHILDREN)
                .setAutoCancel(true);
            nm.notify(RESUMO, r.build());
        }
    }

    // (1.0.2) baixar foto, vídeo ou anexo no celular: o WebView do Android ignora o "download" dos links, então a interface manda o
    // arquivo para cá. Foto vai para Imagens/Aero, vídeo para Filmes/Aero (aparecem na galeria) e o resto para Downloads/Aero
    @PluginMethod
    public void salvarArquivo(PluginCall call) {
        final String nome0 = call.getString("nome", "arquivo"), mime0 = call.getString("mime", "application/octet-stream"), b64 = call.getString("dados", "");
        final String nome = (nome0 == null || nome0.isEmpty() ? "arquivo" : nome0).replaceAll("[\\\\/:*?\"<>|\\x00-\\x1f]", "_");
        final String mime = mime0 == null || mime0.isEmpty() ? "application/octet-stream" : mime0;
        if (Build.VERSION.SDK_INT < 29 && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            if (getActivity() != null) ActivityCompat.requestPermissions(getActivity(), new String[] { Manifest.permission.WRITE_EXTERNAL_STORAGE }, 4242);
            call.reject("permissao"); return;
        }
        new Thread(() -> {
            try {
                byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
                boolean foto = mime.startsWith("image/"), video = mime.startsWith("video/");
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentResolver r = getContext().getContentResolver();
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.MediaColumns.DISPLAY_NAME, nome);
                    v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                    v.put(MediaStore.MediaColumns.RELATIVE_PATH, (foto ? Environment.DIRECTORY_PICTURES : video ? Environment.DIRECTORY_MOVIES : Environment.DIRECTORY_DOWNLOADS) + "/Aero");
                    v.put(MediaStore.MediaColumns.IS_PENDING, 1);
                    Uri onde = foto ? MediaStore.Images.Media.EXTERNAL_CONTENT_URI : video ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI : MediaStore.Downloads.EXTERNAL_CONTENT_URI;
                    Uri uri = r.insert(onde, v);
                    if (uri == null) throw new Exception("sem lugar");
                    try (OutputStream o = r.openOutputStream(uri)) { if (o == null) throw new Exception("sem lugar"); o.write(bytes); }
                    v.clear(); v.put(MediaStore.MediaColumns.IS_PENDING, 0); r.update(uri, v, null, null);
                } else {
                    File dir = new File(Environment.getExternalStoragePublicDirectory(foto ? Environment.DIRECTORY_PICTURES : video ? Environment.DIRECTORY_MOVIES : Environment.DIRECTORY_DOWNLOADS), "Aero");
                    if (!dir.exists()) dir.mkdirs();
                    File f = new File(dir, nome); int n = 1; String base = nome.contains(".") ? nome.substring(0, nome.lastIndexOf('.')) : nome, ext = nome.contains(".") ? nome.substring(nome.lastIndexOf('.')) : "";
                    while (f.exists()) f = new File(dir, base + " (" + (n++) + ")" + ext);
                    try (FileOutputStream o = new FileOutputStream(f)) { o.write(bytes); }
                    MediaScannerConnection.scanFile(getContext(), new String[] { f.getAbsolutePath() }, new String[] { mime }, null);
                }
                call.resolve();
            } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
        }).start();
    }
}
