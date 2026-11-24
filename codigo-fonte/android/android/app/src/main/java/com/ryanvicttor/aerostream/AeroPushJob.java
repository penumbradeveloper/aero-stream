package com.ryanvicttor.aerostream;

import android.Manifest;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

// (0.9.1) com o Aero fechado, o Android acorda este trabalho de tempos em tempos (com internet) e ele pergunta ao servidor se chegou
// mensagem. O servidor responde só quem mandou e em qual conversa (o texto continua cifrado e nunca sai de lá).
public class AeroPushJob extends JobService {
    static final int ID = 7062;
    static final String PREFS = "aero-push";
    static final String CANAL = "aero-msgs"; // (0.9.2) canal novo: com vibração e som ligados

    static void agendar(Context ctx) {
        JobScheduler js = (JobScheduler) ctx.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js == null) return;
        JobInfo.Builder b = new JobInfo.Builder(ID, new ComponentName(ctx, AeroPushJob.class))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
            .setPersisted(true)
            .setPeriodic(15 * 60 * 1000L);
        try { js.schedule(b.build()); } catch (Exception e) { /* sem agendamento: as notificações com o app aberto continuam */ }
    }

    static void cancelar(Context ctx) {
        JobScheduler js = (JobScheduler) ctx.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js != null) js.cancel(ID);
        AeroPushAlarme.cancelar(ctx);
    }

    @Override
    public boolean onStartJob(final JobParameters p) {
        new Thread(() -> {
            try { checar(getApplicationContext()); } catch (Exception e) { /* tenta na próxima */ }
            if (!AeroNotif.naTela) AeroPushAlarme.agendar(getApplicationContext()); // (0.9.2) o celular reiniciou ou o aviso rápido parou: volta
            jobFinished(p, false);
        }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters p) { return true; }

    // (0.9.5) avisa o servidor que o app foi para o fundo (sim) ou voltou (não), pelo próprio Android: a página é congelada logo depois de
    // sair e a conexão dela continua parecendo viva, então só ela avisando não bastava
    static void avisarFundo(Context ctx, boolean sim) {
        final Context c = ctx.getApplicationContext();
        final long em = System.currentTimeMillis();
        new Thread(() -> {
            try {
                SharedPreferences sp = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
                String t = sp.getString("t", ""), api = sp.getString("api", "");
                if (t.isEmpty() || !api.startsWith("https://")) return;
                HttpURLConnection con = (HttpURLConnection) new URL(api + "/api/push/fundo").openConnection();
                con.setConnectTimeout(8000);
                con.setReadTimeout(8000);
                con.setRequestMethod("POST");
                con.setDoOutput(true);
                con.setRequestProperty("Content-Type", "application/json");
                JSONObject corpo = new JSONObject();
                corpo.put("t", t);
                corpo.put("sim", sim);
                corpo.put("em", em);
                try (OutputStream o = con.getOutputStream()) { o.write(corpo.toString().getBytes(StandardCharsets.UTF_8)); }
                con.getResponseCode();
                con.disconnect();
            } catch (Exception e) { /* a checagem em segundo plano continua */ }
        }).start();
    }

    static void checar(Context ctx) throws Exception {
        if (AeroNotif.naTela) return; // o app está aberto: os avisos chegam por ele
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String t = sp.getString("t", ""), api = sp.getString("api", "");
        if (t.isEmpty() || !api.startsWith("https://")) { cancelar(ctx); return; }
        HttpURLConnection con = (HttpURLConnection) new URL(api + "/api/push/novas").openConnection();
        con.setConnectTimeout(8000);
        con.setReadTimeout(10000);
        con.setRequestMethod("POST");
        con.setDoOutput(true);
        con.setRequestProperty("Content-Type", "application/json");
        JSONObject corpo = new JSONObject();
        corpo.put("t", t);
        try (OutputStream o = con.getOutputStream()) { o.write(corpo.toString().getBytes(StandardCharsets.UTF_8)); }
        if (con.getResponseCode() != 200) { con.disconnect(); return; }
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        try (InputStream in = con.getInputStream()) { byte[] b = new byte[4096]; int n; while ((n = in.read(b)) > 0 && buf.size() < 200000) buf.write(b, 0, n); }
        con.disconnect();
        JSONObject d = new JSONObject(buf.toString("UTF-8"));
        if (d.optBoolean("fim")) { sp.edit().clear().apply(); cancelar(ctx); return; }
        // (1.0.2) as conversas lidas em outro aparelho: a notificação delas sai daqui
        JSONArray lidas = d.optJSONArray("lidas");
        if (lidas != null && lidas.length() > 0) {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) for (int i = 0; i < lidas.length(); i++) nm.cancel(("push-" + lidas.optString(i, "")).hashCode());
        }
        JSONArray l = d.optJSONArray("novas");
        if (l == null || l.length() == 0) return;
        Map<String, JSONObject> ult = new LinkedHashMap<>();
        Map<String, Integer> qtd = new LinkedHashMap<>();
        for (int i = 0; i < l.length(); i++) {
            JSONObject x = l.getJSONObject(i);
            String cid = x.optString("cid", "");
            ult.put(cid, x);
            qtd.put(cid, (qtd.containsKey(cid) ? qtd.get(cid) : 0) + 1);
        }
        boolean en = !Locale.getDefault().getLanguage().equals("pt");
        for (Map.Entry<String, JSONObject> e : ult.entrySet()) {
            JSONObject x = e.getValue();
            int n = qtd.get(e.getKey());
            String g = x.optString("g", ""), de = x.optString("de", "Aero");
            String q = n > 1 ? (en ? n + " new messages" : n + " mensagens novas") : (en ? "New message" : "Nova mensagem");
            mostrar(ctx, e.getKey(), g.isEmpty() ? de : g, g.isEmpty() ? q : de + ": " + q);
        }
    }

    private static void mostrar(Context ctx, String cid, String titulo, String texto) {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        AeroNotif.criarCanal(ctx);
        Intent abrir = new Intent(ctx, MainActivity.class);
        abrir.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        abrir.putExtra("aeroCid", cid);
        int id = ("push-" + cid).hashCode();
        PendingIntent pi = PendingIntent.getActivity(ctx, id, abrir, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder n = new NotificationCompat.Builder(ctx, CANAL)
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentTitle(titulo.length() > 80 ? titulo.substring(0, 80) : titulo)
            .setContentText(texto)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .setContentIntent(pi);
        nm.notify(id, n.build());
    }
}
