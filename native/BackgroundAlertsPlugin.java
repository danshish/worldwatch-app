package com.worldwatch.app;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.util.concurrent.TimeUnit;

@CapacitorPlugin(name = "BackgroundAlerts")
public class BackgroundAlertsPlugin extends Plugin {
  @PluginMethod
  public void configureAlerts(PluginCall call) {
    boolean news = call.getBoolean("news", false);
    boolean videos = call.getBoolean("videos", false);
    Context context = getContext();
    SharedPreferences prefs = context.getSharedPreferences("worldwatch-alerts", Context.MODE_PRIVATE);
    prefs.edit().putBoolean("news", news).putBoolean("videos", videos).apply();
    WorkManager manager = WorkManager.getInstance(context);
    if (!news && !videos) {
      manager.cancelUniqueWork("worldwatch-background-alerts");
    } else {
      Constraints constraints = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
      PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(WorldWatchAlertsWorker.class, 15, TimeUnit.MINUTES)
        .setConstraints(constraints).build();
      manager.enqueueUniquePeriodicWork("worldwatch-background-alerts", ExistingPeriodicWorkPolicy.UPDATE, request);
    }
    call.resolve();
  }
}