package com.worldwatch.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.text.Html;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class WorldWatchAlertsWorker extends Worker {
  private static final String TOPICS = "(?i)\\b(conflict|war|invasion|occupation|ceasefire|airstrike|air strike|missile|drone strike|shelling|battle|offensive|troops|military|nato|ukraine|russia|gaza|israel|palestin|hamas|hezbollah|iran|lebanon|syria|yemen|houthi|sudan|myanmar|taiwan|north korea|south china sea|terrorism|insurgency|militia|coup|geopolitic|sanction|defence|defense|weapons|nuclear threat|war crime|humanitarian crisis)\\b";
  private static final String[][] NEWS = {
    {"BBC News","https://feeds.bbci.co.uk/news/world/rss.xml"},
    {"The Guardian","https://www.theguardian.com/world/rss"},
    {"UN News","https://news.un.org/feed/subscribe/en/news/all/rss.xml"}
  };
  private static final String[] CHANNELS = {
    "UC16niRr50-MSBwiO3YDb3RA","UChqUTb7kYRX8-EiaN3XFrSQ","UC52X5wxOL_s5yw0dQk7NtgA",
    "UCoMdktPbSTixAyNGwb-UYkQ","UCknLrEdhRCp1aegoMqRaCZg","UCNye-wNBqNL5ZzHSJj3l8Bg"
  };

  public WorldWatchAlertsWorker(@NonNull Context context, @NonNull WorkerParameters params) { super(context, params); }

  @NonNull @Override public Result doWork() {
    Context context = getApplicationContext();
    SharedPreferences prefs = context.getSharedPreferences("worldwatch-alerts", Context.MODE_PRIVATE);
    try {
      if (prefs.getBoolean("news", false)) checkNews(context, prefs);
      if (prefs.getBoolean("videos", false)) checkVideos(context, prefs);
      return Result.success();
    } catch (Exception e) { return Result.retry(); }
  }

  private void checkNews(Context c, SharedPreferences p) throws Exception {
    List<String> ids = new ArrayList<>(); List<String> titles = new ArrayList<>();
    for (String[] feed : NEWS) {
      String xml = fetch(feed[1]);
      Matcher m = Pattern.compile("(?is)<item\\b.*?</item>").matcher(xml);
      while (m.find()) {
        String title = tag(m.group(), "title"); String link = tag(m.group(), "link");
        if (!title.isEmpty() && !link.isEmpty() && Pattern.compile(TOPICS).matcher(title).find()) { ids.add(link); titles.add(title); }
      }
    }
    notifyFresh(c, p, "news", ids, titles, 7101, "WORLDWATCH · New intelligence");
  }

  private void checkVideos(Context c, SharedPreferences p) throws Exception {
    List<String> ids = new ArrayList<>(); List<String> titles = new ArrayList<>();
    for (String channel : CHANNELS) {
      String xml = fetch("https://www.youtube.com/feeds/videos.xml?channel_id=" + channel);
      Matcher m = Pattern.compile("(?is)<entry\\b.*?</entry>").matcher(xml);
      while (m.find()) {
        String entry = m.group(); String title = tag(entry, "title");
        String id = tag(entry, "yt:videoId");
        if (id.isEmpty()) { String link = tag(entry, "link"); Matcher vm = Pattern.compile("[?&]v=([^&]+)").matcher(link); if (vm.find()) id = vm.group(1); }
        if (!title.isEmpty() && !id.isEmpty() && Pattern.compile(TOPICS).matcher(title).find()) { ids.add(id); titles.add(title); }
      }
    }
    notifyFresh(c, p, "videos", ids, titles, 7102, "WORLDWATCH · New video briefing");
  }

  private void notifyFresh(Context c, SharedPreferences p, String key, List<String> ids, List<String> titles, int notificationId, String heading) {
    Set<String> previous = p.getStringSet("seen-" + key, null);
    Set<String> current = new HashSet<>(ids);
    if (previous != null) {
      List<String> fresh = new ArrayList<>();
      for (int i=0;i<ids.size();i++) if (!previous.contains(ids.get(i))) fresh.add(titles.get(i));
      if (!fresh.isEmpty()) post(c, notificationId, heading, fresh.size()==1 ? fresh.get(0) : fresh.size()+" new reports. Latest: "+fresh.get(0));
    }
    p.edit().putStringSet("seen-" + key, current).apply();
  }

  private void post(Context c, int id, String title, String body) {
    if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(c, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
    NotificationManager manager = (NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);
    if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(new NotificationChannel("worldwatch-alerts", "WORLDWATCH alerts", NotificationManager.IMPORTANCE_HIGH));
    NotificationCompat.Builder n = new NotificationCompat.Builder(c, "worldwatch-alerts")
      .setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle(title).setContentText(body)
      .setStyle(new NotificationCompat.BigTextStyle().bigText(body)).setPriority(NotificationCompat.PRIORITY_HIGH).setAutoCancel(true);
    manager.notify(id, n.build());
  }

  private String fetch(String address) throws Exception {
    HttpURLConnection conn = (HttpURLConnection)new URL(address).openConnection();
    conn.setConnectTimeout(12000); conn.setReadTimeout(15000); conn.setRequestProperty("User-Agent", "WORLDWATCH Android");
    try (InputStream in = conn.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
      byte[] buffer = new byte[8192]; int n; while ((n=in.read(buffer))!=-1) out.write(buffer,0,n);
      return new String(out.toByteArray(), StandardCharsets.UTF_8);
    } finally { conn.disconnect(); }
  }

  private String tag(String source, String name) {
    Matcher m = Pattern.compile("(?is)<" + Pattern.quote(name) + "(?:\\s+[^>]*)?>(.*?)</" + Pattern.quote(name) + "\\s*>").matcher(source);
    if (!m.find()) return "";
    String value = m.group(1).replaceAll("(?is)<!\\[CDATA\\[(.*?)\\]\\]>", "$1").replaceAll("(?is)<[^>]+>", "").trim();
    return Html.fromHtml(value, Html.FROM_HTML_MODE_LEGACY).toString().trim();
  }
}