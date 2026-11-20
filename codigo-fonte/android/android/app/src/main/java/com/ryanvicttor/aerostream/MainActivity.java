package com.ryanvicttor.aerostream;

import android.content.Intent;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.webkit.WebSettings;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AeroNotif.class); // (0.8.6) notificações de mensagem com a foto e o nome de quem mandou
        super.onCreate(savedInstanceState);
        // (0.6.0) a música dos perfis toca num tocador do YouTube dentro do app; o WebView do Android só deixava tocar som com um toque
        // DENTRO desse tocador (que fica escondido), então ela nunca começava. Tocar ao apertar o play do Aero passa a valer.
        WebSettings ajustes = getBridge().getWebView().getSettings();
        ajustes.setMediaPlaybackRequiresUserGesture(false);
        // (0.9.1) vídeo ainda sem imagem (a tela de alguém chegando na chamada) mostrava o "play" cinza gigante do Android: agora fica vazio
        getBridge().getWebView().setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
            @Override
            public Bitmap getDefaultVideoPoster() { return Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888); }
        });
        abrirAer(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        abrirAer(intent);
    }

    // (1.0.0) "Abrir com" o Aero num .aer: lê o arquivo (até 30 MB) e entrega para a interface, que confere tudo (aer.js).
    // Nada é instalado aqui: a interface mostra o que a skin muda e pergunta antes.
    private void abrirAer(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) return;
        Uri uri = intent.getData();
        if (uri == null || "aerostream".equals(uri.getScheme())) return;
        String nome = "skin.aer";
        try (Cursor c = getContentResolver().query(uri, null, null, null, null)) {
            if (c != null && c.moveToFirst()) { int i = c.getColumnIndex(OpenableColumns.DISPLAY_NAME); if (i >= 0 && c.getString(i) != null) nome = c.getString(i); }
        } catch (Exception e) { /* fica o nome padrão */ }
        if (!nome.toLowerCase().endsWith(".aer")) return;
        final String nomeLimpo = nome.replaceAll("[^A-Za-z0-9 ._-]", "").replaceAll("^\\s+|\\s+$", "");
        new Thread(() -> {
            try (InputStream in = getContentResolver().openInputStream(uri)) {
                if (in == null) return;
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[65536]; int n; long total = 0;
                while ((n = in.read(buf)) > 0) { total += n; if (total > 30L * 1024 * 1024) return; out.write(buf, 0, n); }
                final String b64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
                entregarAer(nomeLimpo, b64, 0);
            } catch (Exception e) { /* arquivo ilegível: nada acontece */ }
        }).start();
    }

    // espera a interface carregar (até ~30 s) e entrega
    private void entregarAer(final String nome, final String b64, final int tentativa) {
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (getBridge() == null || getBridge().getWebView() == null) return;
            getBridge().getWebView().evaluateJavascript("!!(window.Aero && window.Aero.aer)", (pronto) -> {
                if (!"true".equals(pronto)) { if (tentativa < 30) entregarAer(nome, b64, tentativa + 1); return; }
                getBridge().getWebView().evaluateJavascript("window.dispatchEvent(new CustomEvent('aero-abrir-aer',{detail:{nome:'" + nome + "',b64:'" + b64 + "'}}))", null);
            });
        }, tentativa == 0 ? 300 : 1000);
    }
}
