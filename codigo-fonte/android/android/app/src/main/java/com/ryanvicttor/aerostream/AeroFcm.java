package com.ryanvicttor.aerostream;

import android.content.Context;
import android.content.SharedPreferences;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

// (1.0.3) o aviso na hora: o servidor manda um toque vazio pelo push do Google (sem quem mandou nem texto) e o app pergunta as
// novidades com o token dele, como antes. Sem o Google no celular, fica a checagem de tempos em tempos (AeroPushJob/AeroPushAlarme)
public class AeroFcm extends FirebaseMessagingService {
    @Override
    public void onNewToken(String token) { enviar(getApplicationContext(), token); }

    @Override
    public void onMessageReceived(RemoteMessage m) {
        try { AeroPushJob.checar(getApplicationContext()); } catch (Exception e) { /* a checagem de tempos em tempos pega depois */ }
    }

    // pede o token do push do Google (se o celular tiver) e entrega ao servidor
    static void registrar(Context ctx) {
        final Context c = ctx.getApplicationContext();
        try {
            if (FirebaseApp.getApps(c).isEmpty() && FirebaseApp.initializeApp(c) == null) return;
            FirebaseMessaging.getInstance().getToken().addOnSuccessListener((tok) -> enviar(c, tok));
        } catch (Throwable e) { /* sem o Google: fica a checagem de tempos em tempos */ }
    }

    static void enviar(Context ctx, String tok) {
        final Context c = ctx.getApplicationContext();
        if (tok == null || tok.isEmpty()) return;
        new Thread(() -> {
            try {
                SharedPreferences sp = c.getSharedPreferences(AeroPushJob.PREFS, Context.MODE_PRIVATE);
                String t = sp.getString("t", ""), api = sp.getString("api", "");
                if (t.isEmpty() || !api.startsWith("https://")) return;
                HttpURLConnection con = (HttpURLConnection) new URL(api + "/api/push/fcm").openConnection();
                con.setConnectTimeout(8000);
                con.setReadTimeout(8000);
                con.setRequestMethod("POST");
                con.setDoOutput(true);
                con.setRequestProperty("Content-Type", "application/json");
                JSONObject corpo = new JSONObject();
                corpo.put("t", t);
                corpo.put("f", tok);
                try (OutputStream o = con.getOutputStream()) { o.write(corpo.toString().getBytes(StandardCharsets.UTF_8)); }
                boolean ok = con.getResponseCode() == 200;
                con.disconnect();
                sp.edit().putBoolean("fcm", ok).apply();
            } catch (Exception e) { /* tenta de novo na próxima vez que abrir */ }
        }).start();
    }
}
