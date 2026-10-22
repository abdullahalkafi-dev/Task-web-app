package com.dayflow.nativecore

import android.content.Context
import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.ZoneId
import java.util.UUID

/** Single transaction owner for React Native, widget, overlay and reminder actions. */
class Repository private constructor(private val context: Context, val user: String) : SQLiteOpenHelper(context, "dayflow_${user}.sqlite", null, 1) {
  companion object {
    private val instances = mutableMapOf<String, Repository>()
    var onChange: (() -> Unit)? = null
    fun prefs(c: Context) = c.getSharedPreferences("dayflow-native", Context.MODE_PRIVATE)
    fun active(c: Context): String? = prefs(c).getString("account", null)
    @Synchronized fun get(c: Context, user: String): Repository {
      require(Regex("[A-Za-z0-9-]{1,80}").matches(user)) { "Invalid account" }
      return instances.getOrPut(user) { Repository(c.applicationContext, user) }
    }
    fun today(): String = java.time.LocalDate.now(ZoneId.of("Asia/Dhaka")).toString()
    fun stamp(previous: String? = null): String = Instant.ofEpochMilli(maxOf(System.currentTimeMillis(), (previous?.let { Instant.parse(it).toEpochMilli() } ?: 0L) + 1)).toString()
  }
  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL("CREATE TABLE docs(entity TEXT NOT NULL,id TEXT NOT NULL,json TEXT NOT NULL,seen INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(entity,id))")
    db.execSQL("CREATE TABLE outbox(seq INTEGER PRIMARY KEY AUTOINCREMENT,entity TEXT NOT NULL,id TEXT NOT NULL,stamp TEXT NOT NULL)")
    db.execSQL("CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL)")
    db.execSQL("CREATE TABLE uploads(id TEXT PRIMARY KEY,json TEXT NOT NULL)")
    db.execSQL("CREATE TABLE delivered(key TEXT PRIMARY KEY)")
  }
  override fun onConfigure(db: SQLiteDatabase) { db.enableWriteAheadLogging() }
  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) { check(oldVersion == newVersion) { "Unsupported migration; data retained" } }
  @Synchronized fun list(entity: String): JSONArray {
    val out = JSONArray()
    readableDatabase.rawQuery("SELECT json FROM docs WHERE entity=?", arrayOf(entity)).use { while(it.moveToNext()) out.put(JSONObject(it.getString(0))) }
    return out
  }
  @Synchronized fun doc(entity: String, id: String): JSONObject? = readableDatabase.rawQuery("SELECT json FROM docs WHERE entity=? AND id=?", arrayOf(entity,id)).use { if(it.moveToFirst()) JSONObject(it.getString(0)) else null }
  @Synchronized fun meta(key: String): String? = readableDatabase.rawQuery("SELECT value FROM meta WHERE key=?", arrayOf(key)).use { if(it.moveToFirst()) it.getString(0) else null }
  @Synchronized fun setMeta(key: String, value: String?) {
    if(value == null) {
      writableDatabase.delete("meta", "key=?", arrayOf(key))
      if(key.startsWith("draft:") || key.startsWith("recovery:")) {
        val rows=uploads();val owners=mutableSetOf<Pair<String,String>>()
        for(i in 0 until rows.length()){val row=rows.getJSONObject(i);owners.add(row.getString("entity") to row.getString("entityId"))}
        for((entity,id) in owners)pruneUploads(entity,id)
      }
    }
    else check(writableDatabase.insertWithOnConflict("meta", null, ContentValues().apply { put("key",key);put("value",value) }, SQLiteDatabase.CONFLICT_REPLACE)>=0){"Could not save local metadata"}
  }
  private fun save(entity: String, d: JSONObject, seen: Boolean? = null) {
    val values=ContentValues().apply { put("json", d.toString()); if(seen != null)put("seen",if(seen)1 else 0) }
    if(writableDatabase.update("docs", values, "entity=? AND id=?", arrayOf(entity,d.getString("id")))==0) {
      values.put("entity",entity);values.put("id",d.getString("id")); writableDatabase.insertOrThrow("docs",null,values)
    }
  }
  fun changed() { onChange?.invoke(); NativeSurfaces.refresh(context) }
  @Synchronized fun mutate(entity: String, patch: JSONObject): JSONObject {
    require(entity == "task" || entity == "note")
    val id=patch.optString("id").ifBlank { UUID.randomUUID().toString() }
    require(Regex("[A-Za-z0-9-]{1,80}").matches(id))
    val prior=doc(entity,id)
    val previousStatus=prior?.optString("status")
    val now=stamp(prior?.optString("updatedAt"))
    val d=prior ?: JSONObject().apply {
      put("id",id);put("userId",user);put("title",if(entity=="note")"Untitled note" else "")
      put("descriptionHtml","");put("descriptionText","");put("createdAt",now);put("deletedAt",JSONObject.NULL)
      val all=list(entity); var max=0.0;var min=0.0; for(i in 0 until all.length()){val row=all.getJSONObject(i);if(row.isNull("deletedAt")){max=maxOf(max,row.optDouble("orderIndex",0.0));min=minOf(min,row.optDouble("orderIndex",0.0))}}; put("orderIndex",if(entity=="note")min-1024 else max+1024)
      if(entity=="task") {put("taskDate",today());put("status","notStarted");put("estimatedMinutes",0);put("reminderAt",JSONObject.NULL);put("copiedFromDate",JSONObject.NULL);put("copiedFromTaskId",JSONObject.NULL)}
    }
    for(key in listOf("title","descriptionHtml","descriptionText","orderIndex","taskDate","status","estimatedMinutes","reminderAt","copiedFromDate","copiedFromTaskId","deletedAt")) if(patch.has(key)) d.put(key,patch.get(key))
    require(d.getString("title").trim().isNotEmpty() && d.getString("title").length<=200) { "A title of 1–200 characters is required" }
    require(d.optString("descriptionHtml").length<=2000000) { "Description is too large" }
    require(d.getDouble("orderIndex").isFinite()) {"Invalid task order"}
    if(entity=="task") {
      require(d.getString("status") in listOf("notStarted","started","completed"))
      val minutes=d.getDouble("estimatedMinutes");require(minutes.isFinite() && minutes%1.0==0.0 && minutes in 0.0..1439.0)
      val date=java.time.LocalDate.parse(d.getString("taskDate"));require(date<=java.time.LocalDate.parse(today()).plusDays(1))
      if(!d.isNull("reminderAt"))Instant.parse(d.getString("reminderAt"))
      if(prior!=null && patch.has("status") && previousStatus!=d.getString("status") && !patch.has("orderIndex")) {
        val rows=list("task");var end=0.0
        for(i in 0 until rows.length()){val row=rows.getJSONObject(i);if(row.isNull("deletedAt") && row.optString("taskDate")==d.getString("taskDate") && row.optString("status")==d.getString("status"))end=maxOf(end,row.getDouble("orderIndex"))}
        d.put("orderIndex",end+1024)
      }
    }
    d.put("updatedAt",now);d.put("userId",user)
    writableDatabase.beginTransaction()
    try {
      save(entity,d)
      if(patch.has("localImageSourceId")){val rows=uploads();for(i in 0 until rows.length()){val row=rows.getJSONObject(i);if(row.getString("entity")==entity && row.getString("entityId")==patch.getString("localImageSourceId") && d.getString("descriptionHtml").contains(row.getString("localId"))){row.put("entityId",id);putUpload(row)}}}
      writableDatabase.insertOrThrow("outbox",null,ContentValues().apply {put("entity",entity);put("id",id);put("stamp",now)}); writableDatabase.setTransactionSuccessful()
    } finally { writableDatabase.endTransaction() }
    changed(); return d
  }
  @Synchronized fun outbox(): JSONArray {
    val out=JSONArray()
    readableDatabase.rawQuery("SELECT MAX(seq),entity,id FROM outbox GROUP BY entity,id ORDER BY MAX(seq) LIMIT 100",null).use {
      while(it.moveToNext()) { val d=doc(it.getString(1),it.getString(2)); if(d!=null)out.put(JSONObject().put("seq",it.getLong(0)).put("entity",it.getString(1)).put("id",it.getString(2)).put("doc",d)) }
    };return out
  }
  @Synchronized fun pendingCount(): Int = readableDatabase.rawQuery("SELECT COUNT(*) FROM (SELECT entity,id FROM outbox GROUP BY entity,id)",null).use { it.moveToFirst();it.getInt(0) }
  @Synchronized fun applyRemote(entity: String, remote: JSONObject, acknowledged: String? = null) {
    val id=remote.getString("id");val local=doc(entity,id)
    val newer=local==null || Instant.parse(remote.getString("updatedAt"))>Instant.parse(local.getString("updatedAt"))
    if(newer || local?.optString("updatedAt")==acknowledged) {
      if(local!=null && newer && readableDatabase.rawQuery("SELECT 1 FROM outbox WHERE entity=? AND id=? LIMIT 1",arrayOf(entity,id)).use {it.moveToFirst()}) setMeta("recovery:${entity}:${id}:${local.getString("updatedAt")}",local.toString())
      remote.put("userId",user);save(entity,remote,true)
    } else writableDatabase.execSQL("UPDATE docs SET seen=1 WHERE entity=? AND id=?",arrayOf(entity,id))
  }
  @Synchronized fun acknowledge(seq: Long, entity: String, id: String, sentStamp: String, winner: JSONObject?) {
    writableDatabase.beginTransaction()
    try { if(winner!=null)applyRemote(entity,winner,sentStamp);writableDatabase.delete("outbox","entity=? AND id=? AND seq<=?",arrayOf(entity,id,seq.toString()));writableDatabase.setTransactionSuccessful() } finally {writableDatabase.endTransaction()}
    pruneUploads(entity,id);changed()
  }
  @Synchronized fun mergePull(payload: JSONObject, reset: Boolean) {
    writableDatabase.beginTransaction()
    try {
      if(reset) {
        for(entity in listOf("task","note")) {
          val incoming=payload.getJSONArray(if(entity=="task")"tasks" else "notes");val ids=(0 until incoming.length()).map { incoming.getJSONObject(it).getString("id") }.toSet()
          val missing=mutableListOf<String>()
          readableDatabase.rawQuery("SELECT id,json FROM docs WHERE entity=? AND seen=1",arrayOf(entity)).use { while(it.moveToNext())if(it.getString(0) !in ids){ val id=it.getString(0);if(readableDatabase.rawQuery("SELECT 1 FROM outbox WHERE entity=? AND id=? LIMIT 1",arrayOf(entity,id)).use {c->c.moveToFirst()})setMeta("recovery:${entity}:${id}:expired",it.getString(1));missing.add(id) } }
          for(id in missing){writableDatabase.delete("docs","entity=? AND id=?",arrayOf(entity,id));writableDatabase.delete("outbox","entity=? AND id=?",arrayOf(entity,id))}
        }
      }
      for(entity in listOf("task","note")){val rows=payload.getJSONArray(if(entity=="task")"tasks" else "notes");for(i in 0 until rows.length())applyRemote(entity,rows.getJSONObject(i))}
      setMeta("lastPulledAt",payload.getString("serverTime"));setMeta("lastSyncedAt",Instant.now().toString());writableDatabase.setTransactionSuccessful()
    } finally {writableDatabase.endTransaction()};changed()
  }
  @Synchronized fun recoveries(): JSONArray { val out=JSONArray();readableDatabase.rawQuery("SELECT key,value FROM meta WHERE key LIKE 'recovery:%'",null).use {while(it.moveToNext())out.put(JSONObject().put("key",it.getString(0)).put("doc",JSONObject(it.getString(1))))};return out }
  @Synchronized fun drafts(): JSONArray {val out=JSONArray();readableDatabase.rawQuery("SELECT key,value FROM meta WHERE key LIKE 'draft:%'",null).use{while(it.moveToNext()){val key=it.getString(0);val value=JSONObject(it.getString(1));out.put(JSONObject().put("key",key).put("entity",key.split(":")[1]).put("id",value.getString("id")).put("title",value.optString("title").ifBlank{"Untitled draft"}))}};return out}
  @Synchronized fun uploads(): JSONArray {val out=JSONArray();readableDatabase.rawQuery("SELECT json FROM uploads",null).use {while(it.moveToNext())out.put(JSONObject(it.getString(0)))};return out}
  @Synchronized fun putUpload(row: JSONObject) { check(writableDatabase.insertWithOnConflict("uploads",null,ContentValues().apply{put("id",row.getString("localId"));put("json",row.toString())},SQLiteDatabase.CONFLICT_REPLACE)>=0){"Could not queue image"} }
  @Synchronized fun completeUpload(localId: String,url: String) {
    val all=uploads();for(i in 0 until all.length()){val row=all.getJSONObject(i);if(row.getString("localId")==localId){val entity=row.getString("entity");val d=doc(entity,row.getString("entityId"));if(d!=null){val html=d.getString("descriptionHtml").replace(Regex("<img\\b[^>]*data-local-id=[\"']${Regex.escape(localId)}[\"'][^>]*>")){ m->m.value.replace(Regex("src=[\"'][^\"']*[\"']"),"src=\"$url\"").replace(Regex("\\s*data-local-id=[\"'][^\"']*[\"']"),"") };if(html!=d.getString("descriptionHtml"))mutate(entity,JSONObject().put("id",d.getString("id")).put("descriptionHtml",html))};row.put("uploadedUrl",url);putUpload(row)}}
  }
  @Synchronized private fun pruneUploads(entity: String,id: String) {
    val document=doc(entity,id)
    val draft=meta("draft:$entity:$id") ?: ""
    val queued=readableDatabase.rawQuery("SELECT 1 FROM outbox WHERE entity=? AND id=? LIMIT 1",arrayOf(entity,id)).use{it.moveToFirst()}
    if(queued)return
    val rows=uploads();for(i in 0 until rows.length()) {
      val row=rows.getJSONObject(i);if(row.getString("entity")!=entity || row.getString("entityId")!=id)continue
      val localId=row.getString("localId")
      val recoveryReference=readableDatabase.rawQuery("SELECT 1 FROM meta WHERE (key LIKE 'recovery:%' OR key LIKE 'draft:%') AND instr(value,?)>0 LIMIT 1",arrayOf(localId)).use{it.moveToFirst()}
      if((document?.isNull("deletedAt")==true && document.optString("descriptionHtml").contains(localId)) || draft.contains(localId) || recoveryReference)continue
      val path=android.net.Uri.parse(row.getString("uri")).path
      if(path!=null){val file=java.io.File(path).canonicalFile;val root=java.io.File(context.filesDir,"images/$user").canonicalFile;if(file.path.startsWith(root.path+java.io.File.separator))file.delete()}
      writableDatabase.delete("uploads","id=?",arrayOf(localId))
    }
  }
  @Synchronized fun delivered(key: String): Boolean = readableDatabase.rawQuery("SELECT 1 FROM delivered WHERE key=?",arrayOf(key)).use {it.moveToFirst()}
  @Synchronized fun markDelivered(key: String){writableDatabase.insertWithOnConflict("delivered",null,ContentValues().apply{put("key",key)},SQLiteDatabase.CONFLICT_IGNORE)}
}
