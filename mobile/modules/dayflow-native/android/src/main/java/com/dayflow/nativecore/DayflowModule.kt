package com.dayflow.nativecore

import android.Manifest
import android.app.AlarmManager
import android.content.*
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Base64
import androidx.core.app.ActivityCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.UUID

class DayflowModule: Module() {
  private val context get()=appContext.reactContext ?: throw IllegalStateException("Native context unavailable")
  private fun repo(user: String): Repository {check(Repository.active(context)==user){"Account changed"};return Repository.get(context,user)}
  private fun privateFile(user: String,path: String): File {val file=File(Uri.parse(path).path ?: path).canonicalFile;val root=File(context.filesDir,"images/$user").canonicalFile;require(file.path.startsWith(root.path+File.separator)){"Invalid image path"};return file}
  override fun definition()=ModuleDefinition {
    Name("DayflowNative")
    Events("changed")
    AsyncFunction("testSession") {if(context.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE != 0)Repository.prefs(context).getString("e2eSession",null) else null}
    OnCreate {Repository.onChange={Handler(Looper.getMainLooper()).post{sendEvent("changed",emptyMap<String,Any>())}}}
    OnDestroy {Repository.onChange=null}
    AsyncFunction("activate") { user: String? ->
      context.getSystemService(android.app.NotificationManager::class.java).cancelAll()
      context.stopService(Intent(context,BubbleService::class.java));Repository.prefs(context).edit().apply{if(user==null)remove("account") else {Repository.get(context,user);putString("account",user)}}.commit()
      NativeSurfaces.refreshNow(context)
    }
    AsyncFunction("list") {user: String,entity: String->repo(user).list(entity).toString()}
    AsyncFunction("mutate") {user: String,entity: String,json: String->repo(user).mutate(entity,JSONObject(json)).toString()}
    AsyncFunction("meta") {user: String,key: String->repo(user).meta(key)}
    AsyncFunction("setMeta") {user: String,key: String,value: String?->repo(user).setMeta(key,value);if(key=="syncState")BubbleService.refreshCurrent()}
    AsyncFunction("outbox") {user: String->repo(user).outbox().toString()}
    AsyncFunction("pendingCount") {user: String->repo(user).pendingCount()}
    AsyncFunction("acknowledge") {user: String,seq: Double,entity: String,id: String,stamp: String,winner: String?->repo(user).acknowledge(seq.toLong(),entity,id,stamp,winner?.let{JSONObject(it)})}
    AsyncFunction("mergePull") {user: String,json: String,reset: Boolean->repo(user).mergePull(JSONObject(json),reset)}
    AsyncFunction("recoveries") {user: String->repo(user).recoveries().toString()}
    AsyncFunction("drafts") {user: String->repo(user).drafts().toString()}
    AsyncFunction("uploads") {user: String->repo(user).uploads().toString()}
    AsyncFunction("completeUpload") {user: String,id: String,url: String->
      val rows=repo(user).uploads()
      for(i in 0 until rows.length()){val row=rows.getJSONObject(i);if(row.getString("localId")==id){val key=MessageDigest.getInstance("SHA-256").digest(url.toByteArray()).joinToString(""){"%02x".format(it)};val dir=File(context.cacheDir,"images/$user").apply{mkdirs()};privateFile(user,row.getString("uri")).copyTo(File(dir,key),true)}}
      repo(user).completeUpload(id,url)
    }
    AsyncFunction("queueImage") {user: String,entity: String,entityId: String,uri: String,mime: String->
      repo(user);require(mime in listOf("image/png","image/jpeg","image/webp","image/gif"))
      val id=UUID.nameUUIDFromBytes("$entity:$entityId:$uri".toByteArray()).toString()
      val previous=repo(user).uploads();var existing: JSONObject?=null;for(i in 0 until previous.length())if(previous.getJSONObject(i).getString("localId")==id)existing=previous.getJSONObject(i)
      if(existing!=null)return@AsyncFunction existing!!.toString()
      val dir=File(context.filesDir,"images/$user").apply{mkdirs()};val file=File(dir,id)
      try{context.contentResolver.openInputStream(Uri.parse(uri))!!.use{src->file.outputStream().use{out->val buffer=ByteArray(8192);var total=0;while(true){val n=src.read(buffer);if(n<0)break;total+=n;require(total<=10*1024*1024){"Images must be 10 MB or smaller"};out.write(buffer,0,n)}}}}catch(e:Exception){file.delete();throw e}
      val row=JSONObject().put("localId",id).put("entity",entity).put("entityId",entityId).put("uri",Uri.fromFile(file).toString()).put("mime",mime)
      repo(user).putUpload(row);row.toString()
    }
    AsyncFunction("imageData") {user: String,source: String,token: String,apiOrigin: String->
      repo(user)
      val file: File
      val mime: String
      if(source.startsWith("local:")) {
        val rows=repo(user).uploads();var row: JSONObject?=null
        for(i in 0 until rows.length())if(rows.getJSONObject(i).getString("localId")==source.removePrefix("local:"))row=rows.getJSONObject(i)
        require(row!=null);file=privateFile(user,row!!.getString("uri"));mime=row!!.getString("mime")
      } else {
        val debug=context.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE != 0
        val origin=if(debug && apiOrigin.startsWith("http://10.0.2.2:"))apiOrigin else "https://task-web-app.silverjeanscloth.com"
        val absolute=if(source.startsWith("/uploads/"))origin+source else source
        val url=URL(absolute);require(url.protocol=="https" || (debug && url.host=="10.0.2.2" && url.protocol=="http"))
        val base=URL(origin)
        val own=url.protocol==base.protocol && url.host==base.host && url.port==base.port && url.path.startsWith("/uploads/$user/")
        val key=MessageDigest.getInstance("SHA-256").digest((if(own)url.path else absolute).toByteArray()).joinToString(""){"%02x".format(it)}
        val dir=File(context.cacheDir,"images/$user").apply{mkdirs()};file=File(dir,key)
        mime=if(url.path.endsWith(".gif"))"image/gif" else if(url.path.endsWith(".png"))"image/png" else if(url.path.endsWith(".jpg")||url.path.endsWith(".jpeg"))"image/jpeg" else "image/webp"
        if(!file.exists()) {
          val conn=url.openConnection() as HttpURLConnection;conn.instanceFollowRedirects=false;conn.connectTimeout=15000;conn.readTimeout=15000;if(own)conn.setRequestProperty("Authorization","Bearer $token")
          try{require(conn.responseCode==200){"Image unavailable"};val temp=File(dir,"$key.tmp");try{conn.inputStream.use{src->temp.outputStream().use{out->val buffer=ByteArray(8192);var total=0;while(true){val n=src.read(buffer);if(n<0)break;total+=n;require(total<=10*1024*1024);out.write(buffer,0,n)}}};check(temp.renameTo(file))}finally{temp.delete()}}finally{conn.disconnect()}
        }
        val files=dir.listFiles()?.sortedBy{it.lastModified()} ?: emptyList();var bytes=files.sumOf{it.length()};for(old in files){if(bytes<=100*1024*1024)break;if(old!=file){bytes-=old.length();old.delete()}}
      }
      val detected=file.inputStream().buffered().use {java.net.URLConnection.guessContentTypeFromStream(it)} ?: mime
      "data:$detected;base64,"+Base64.encodeToString(file.readBytes(),Base64.NO_WRAP)
    }
    AsyncFunction("permissions") {mapOf("overlay" to Settings.canDrawOverlays(context),"notifications" to (Build.VERSION.SDK_INT<33 || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED),"exactAlarms" to context.getSystemService(AlarmManager::class.java).canScheduleExactAlarms(),"bubble" to BubbleService.active)}
    AsyncFunction("requestPermission") {kind: String->
      val activity=appContext.currentActivity ?: throw IllegalStateException("Open the app first")
      activity.runOnUiThread {when(kind){
        "overlay"->activity.startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,Uri.parse("package:${context.packageName}")))
        "exactAlarms"->activity.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:${context.packageName}")))
        "notifications"->if(Build.VERSION.SDK_INT>=33)ActivityCompat.requestPermissions(activity,arrayOf(Manifest.permission.POST_NOTIFICATIONS),5401)
      }}
    }
    AsyncFunction("setBubble") {enabled: Boolean->
      if(enabled){check(Settings.canDrawOverlays(context)){"Allow display over other apps first"};check(Repository.active(context)!=null);context.startForegroundService(Intent(context,BubbleService::class.java))} else context.stopService(Intent(context,BubbleService::class.java))
      Unit
    }
    AsyncFunction("appVisible") {visible: Boolean->BubbleService.appVisible=visible;BubbleService.refreshCurrent();NativeSurfaces.refresh(context)}
    AsyncFunction("bubbleActive") {BubbleService.needsSync(context)}
    AsyncFunction("pinWidget") {
      val manager=context.getSystemService(android.appwidget.AppWidgetManager::class.java)
      if(manager.isRequestPinAppWidgetSupported)manager.requestPinAppWidget(ComponentName(context,TodayWidget::class.java),null,null) else false
    }
    AsyncFunction("incoming") {Repository.prefs(context).getString("incoming","[]") ?: "[]"}
    AsyncFunction("consumeIncoming") {id: String->
      require(Regex("[A-Za-z0-9-]{1,80}").matches(id))
      synchronized(ShareActivity::class.java){
        val prefs=Repository.prefs(context);val items=JSONArray(prefs.getString("incoming","[]"));val next=JSONArray()
        for(i in 0 until items.length())if(items.getJSONObject(i).getString("id")!=id)next.put(items.get(i))
        check(prefs.edit().putString("incoming",next.toString()).commit())
        File(context.filesDir,"incoming/$id").deleteRecursively()
      }
      Unit
    }
    AsyncFunction("storage") {user: String->repo(user);mapOf("databaseBytes" to context.getDatabasePath("dayflow_${user}.sqlite").length().toDouble(),"pendingImageBytes" to (File(context.filesDir,"images/$user").walkTopDown().filter{it.isFile}.sumOf{it.length()}).toDouble(),"cacheBytes" to (File(context.cacheDir,"images/$user").walkTopDown().filter{it.isFile}.sumOf{it.length()}).toDouble())}
  }
}
