package com.dayflow.nativecore

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Base64
import org.json.JSONObject
import java.io.File
import androidx.core.content.FileProvider

/** Debug source set only. Never compiled/registered in the release APK. */
class TestReceiver: BroadcastReceiver() {
  override fun onReceive(c: Context,i: Intent) {
    check(c.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE != 0)
    val payload=i.getStringExtra("payload")?.let{JSONObject(String(Base64.decode(it,Base64.URL_SAFE or Base64.NO_WRAP)))}
    when(i.action) {
      "dayflow.test.SESSION" -> Repository.prefs(c).edit().putString("e2eSession",payload!!.toString()).commit()
      "dayflow.test.MUTATE" -> {val user=Repository.active(c)!!;Repository.get(c,user).mutate(payload!!.getString("entity"),payload.getJSONObject("doc"))}
      "dayflow.test.COMPLETE" -> {val user=Repository.active(c)!!;TodayWidget().onReceive(c,Intent("dayflow.COMPLETE").putExtra("user",user).putExtra("id",payload!!.getString("id")))}
      "dayflow.test.REMINDER" -> {val user=Repository.active(c)!!;val task=Repository.get(c,user).doc("task",payload!!.getString("id"))!!;ReminderReceiver().onReceive(c,Intent(payload.getString("action")).putExtra("user",user).putExtra("id",task.getString("id")).putExtra("at",task.getString("reminderAt")))}
      "dayflow.test.SHARE_IMAGE" -> {
        val file=File(c.cacheDir,"e2e-image.png");file.writeBytes(Base64.decode(payload!!.getString("base64"),Base64.DEFAULT))
        val uri=FileProvider.getUriForFile(c,"${c.packageName}.FileSystemFileProvider",file)
        c.startActivity(Intent(c,ShareActivity::class.java).setAction(Intent.ACTION_SEND).setType("image/png").putExtra(Intent.EXTRA_STREAM,uri).putExtra(Intent.EXTRA_SUBJECT,"OfflineSharedImage").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION))
      }
      "dayflow.test.DUMP" -> {
        val user=Repository.active(c);val out=JSONObject().put("account",user).put("bubble",BubbleService.active)
        if(user!=null){val repo=Repository.get(c,user);out.put("tasks",repo.list("task")).put("notes",repo.list("note")).put("pending",repo.pendingCount()).put("recoveries",repo.recoveries()).put("pendingUploads",repo.uploads().length())}
        out.put("notifications",c.getSystemService(android.app.NotificationManager::class.java).activeNotifications.size)
        out.put("widgetCount",c.getSystemService(android.appwidget.AppWidgetManager::class.java).getAppWidgetIds(android.content.ComponentName(c,TodayWidget::class.java)).size)
        File(c.filesDir,"e2e-state.json").writeText(out.toString())
      }
    }
  }
}
