package com.dayflow.nativecore

import android.Manifest
import android.app.*
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.*
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant

object NativeSurfaces {
  const val REMINDERS="dayflow-reminders"
  const val OVERLAY="dayflow-overlay"
  private val handler=Handler(Looper.getMainLooper())
  val receiverExecutor=java.util.concurrent.Executors.newSingleThreadExecutor()
  private var refreshScheduled=false
  fun channels(c: Context) {
    val nm=c.getSystemService(NotificationManager::class.java)
    nm.createNotificationChannel(NotificationChannel(REMINDERS,"Task reminders",NotificationManager.IMPORTANCE_DEFAULT))
    nm.createNotificationChannel(NotificationChannel(OVERLAY,"Floating task panel",NotificationManager.IMPORTANCE_LOW))
  }
  fun open(c: Context, route: String=""): PendingIntent {
    val i=(c.packageManager.getLaunchIntentForPackage(c.packageName) ?: Intent().setClassName(c.packageName,"${c.packageName}.MainActivity")).apply {action=Intent.ACTION_VIEW;data=Uri.parse("dayflow:///$route");addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)}
    return PendingIntent.getActivity(c,0,i,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }
  fun action(c: Context,user: String,id: String,at: String,action: String): PendingIntent {
    val i=Intent(c,ReminderReceiver::class.java).setAction(action).setData(Uri.parse("dayflow://alarm/$user/$id/${Uri.encode(at)}/$action")).putExtra("user",user).putExtra("id",id).putExtra("at",at)
    return PendingIntent.getBroadcast(c,0,i,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }
  @Synchronized fun refresh(c: Context) {
    // Repository writers can run on native-module or receiver threads. Never
    // hold a surface lock while waiting for a repository held by another writer.
    if(refreshScheduled)return
    refreshScheduled=true
    val application=c.applicationContext
    handler.post {
      synchronized(this){refreshScheduled=false}
      refreshNow(application)
    }
  }
  fun refreshNow(c: Context){channels(c);ReminderScheduler.reconcile(c);TodayWidget.refresh(c);BubbleService.refreshCurrent()}
}

object ReminderScheduler {
  @Synchronized fun reconcile(c: Context) {
    val prefs=Repository.prefs(c);val alarm=c.getSystemService(AlarmManager::class.java)
    val old=JSONArray(prefs.getString("alarms","[]"));for(i in 0 until old.length()){val r=old.getJSONObject(i);alarm.cancel(NativeSurfaces.action(c,r.getString("user"),r.getString("id"),r.getString("at"),"fire"))}
    val next=JSONArray();val user=Repository.active(c)
    if(user!=null) {
      val repo=Repository.get(c,user);val tasks=repo.list("task")
      for(i in 0 until tasks.length()) {
        val d=tasks.getJSONObject(i);val at=d.optString("reminderAt","")
        if(!d.isNull("deletedAt") || d.optString("status")=="completed")NotificationManagerCompat.from(c).cancel(("$user:${d.getString("id")}").hashCode())
        val time=runCatching {Instant.parse(at).toEpochMilli()}.getOrNull() ?: continue
        if(!d.isNull("deletedAt") || d.optString("status")=="completed" || time<=System.currentTimeMillis() || repo.delivered("${d.getString("id")}:$at"))continue
        val r=JSONObject().put("user",user).put("id",d.getString("id")).put("at",at);next.put(r)
        val pi=NativeSurfaces.action(c,user,d.getString("id"),at,"fire")
        try {
          if(alarm.canScheduleExactAlarms())alarm.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,time,pi) else alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,time,pi)
        } catch(_:SecurityException) {alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,time,pi)}
      }
    }
    prefs.edit().putString("alarms",next.toString()).apply()
    // Android may delay this update; the widget also refreshes when interacted with.
    val midnight=java.time.LocalDate.now(java.time.ZoneId.of("Asia/Dhaka")).plusDays(1).atStartOfDay(java.time.ZoneId.of("Asia/Dhaka")).toInstant().toEpochMilli()
    alarm.set(AlarmManager.RTC,midnight,PendingIntent.getBroadcast(c,1,Intent(c,MaintenanceReceiver::class.java).setAction("dayflow.MIDNIGHT"),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
  }
}

class ReminderReceiver: BroadcastReceiver() {
  override fun onReceive(c: Context,i: Intent) {
    val user=i.getStringExtra("user") ?: return;if(Repository.active(c)!=user)return
    val id=i.getStringExtra("id") ?: return;val repo=Repository.get(c,user);val d=repo.doc("task",id) ?: return
    if(!d.isNull("deletedAt") || d.optString("status")=="completed")return
    val at=i.getStringExtra("at") ?: "";val notificationId=("$user:$id").hashCode()
    if(d.optString("reminderAt")!=at)return
    when(i.action) {
      "complete" -> {repo.mutate("task",JSONObject().put("id",id).put("status","completed"));NotificationManagerCompat.from(c).cancel(notificationId);NativeSurfaces.refreshNow(c)}
      "snooze" -> {repo.mutate("task",JSONObject().put("id",id).put("reminderAt",Instant.now().plusSeconds(600).toString()));NotificationManagerCompat.from(c).cancel(notificationId);NativeSurfaces.refreshNow(c)}
      "fire" -> {
        if(d.optString("reminderAt")!=at || repo.delivered("$id:$at"))return
        val scheduled=runCatching{Instant.parse(at).toEpochMilli()}.getOrNull() ?: return
        if(System.currentTimeMillis()-scheduled>15*60*1000)return
        if(Build.VERSION.SDK_INT>=33 && c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return
        NativeSurfaces.channels(c)
        val n=NotificationCompat.Builder(c,NativeSurfaces.REMINDERS).setSmallIcon(android.R.drawable.ic_popup_reminder).setContentTitle(d.getString("title")).setContentText("Dayflow task reminder").setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setAutoCancel(true).setContentIntent(NativeSurfaces.open(c,"editor?entity=task&id=$id"))
          .addAction(0,"Complete",NativeSurfaces.action(c,user,id,at,"complete"))
          .addAction(0,"Snooze 10 min",NativeSurfaces.action(c,user,id,at,"snooze"))
        NotificationManagerCompat.from(c).notify(notificationId,n.build());repo.markDelivered("$id:$at")
      }
    }
  }
}

class MaintenanceReceiver: BroadcastReceiver() {override fun onReceive(c: Context,i: Intent){
  val pending=goAsync()
  NativeSurfaces.receiverExecutor.execute{try{NativeSurfaces.refreshNow(c.applicationContext)}finally{pending?.finish()}}
}}

class TodayWidget: AppWidgetProvider() {
  override fun onUpdate(c: Context,m: AppWidgetManager,ids: IntArray){refresh(c)}
  override fun onAppWidgetOptionsChanged(c: Context,m: AppWidgetManager,id: Int,options: android.os.Bundle){refresh(c)}
  override fun onReceive(c: Context,i: Intent) {
    super.onReceive(c,i)
    if(i.action=="dayflow.COMPLETE") {
      val user=i.getStringExtra("user");val id=i.getStringExtra("id")
      if(user!=null && id!=null && user==Repository.active(c)){val repo=Repository.get(c,user);val d=repo.doc("task",id);if(d!=null && d.isNull("deletedAt")){repo.mutate("task",JSONObject().put("id",id).put("status","completed"));NativeSurfaces.refreshNow(c)}}
    }
  }
  companion object {
    fun refresh(c: Context) {
      val manager=AppWidgetManager.getInstance(c);val ids=manager.getAppWidgetIds(ComponentName(c,TodayWidget::class.java));if(ids.isEmpty())return
      for(widgetId in ids) {
      val root=RemoteViews(c.packageName,R.layout.dayflow_widget)
      root.setOnClickPendingIntent(R.id.widget_title,NativeSurfaces.open(c))
      root.setOnClickPendingIntent(R.id.widget_add,NativeSurfaces.open(c,"editor?entity=task"))
      root.removeAllViews(R.id.widget_tasks)
      val user=Repository.active(c)
      if(user==null)root.setTextViewText(R.id.widget_status,"Open Dayflow to sign in") else {
        val repo=Repository.get(c,user);val rows=repo.list("task");val all=(0 until rows.length()).map{rows.getJSONObject(it)}.filter {it.isNull("deletedAt") && it.optString("taskDate")==Repository.today()}.sortedBy{it.optDouble("orderIndex")}
        val done=all.count{it.optString("status")=="completed"}
        val synced=repo.meta("lastSyncedAt")?.take(16)?.replace('T',' ') ?: "Never"
        root.setTextViewText(R.id.widget_status,"$done/${all.size} done · Synced $synced UTC")
        val height=manager.getAppWidgetOptions(widgetId).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,200)
        val visibleRows=((height-148)/48).coerceIn(1,5)
        for(d in all.filter{it.optString("status")!="completed"}.take(visibleRows)) {
          val row=RemoteViews(c.packageName,R.layout.dayflow_widget_row);val id=d.getString("id")
          row.setTextViewText(R.id.widget_task,d.getString("title"));row.setOnClickPendingIntent(R.id.widget_task,NativeSurfaces.open(c,"editor?entity=task&id=$id"))
          val intent=Intent(c,TodayWidget::class.java).setAction("dayflow.COMPLETE").setData(Uri.parse("dayflow://widget/$user/$id")).putExtra("user",user).putExtra("id",id)
          row.setOnClickPendingIntent(R.id.widget_complete,PendingIntent.getBroadcast(c,0,intent,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE));root.addView(R.id.widget_tasks,row)
        }
      }
      manager.updateAppWidget(widgetId,root)
      }
    }
  }
}
