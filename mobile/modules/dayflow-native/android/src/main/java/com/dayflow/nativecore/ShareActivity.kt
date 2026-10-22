package com.dayflow.nativecore

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.TextView
import android.view.Gravity
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID

class ShareActivity: Activity() {
  private lateinit var captureId: String
  override fun onSaveInstanceState(out: Bundle){out.putString("captureId",captureId);super.onSaveInstanceState(out)}
  @Suppress("DEPRECATION")
  override fun onCreate(saved: Bundle?) {
    super.onCreate(saved)
    setContentView(TextView(this).apply{text="Preparing your Dayflow capture…";textSize=18f;gravity=Gravity.CENTER})
    captureId=saved?.getString("captureId") ?: UUID.randomUUID().toString()
    Thread {
    runCatching {
      val id=captureId;val images=JSONArray()
      val uris=if(intent.action==Intent.ACTION_SEND_MULTIPLE)intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM) ?: arrayListOf() else arrayListOf<Uri>().apply{intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)?.let{add(it)}}
      for((index,uri) in uris.take(10).withIndex()) {
        val mime=contentResolver.getType(uri) ?: continue
        if(mime !in listOf("image/png","image/jpeg","image/webp","image/gif"))continue
        val dir=File(filesDir,"incoming/$id").apply{mkdirs()};val target=File(dir,"image-$index")
        try{contentResolver.openInputStream(uri)!!.use{src->target.outputStream().use{out->val buffer=ByteArray(8192);var total=0;while(true){val n=src.read(buffer);if(n<0)break;total+=n;require(total<=10*1024*1024);out.write(buffer,0,n)}}};images.put(JSONObject().put("uri",Uri.fromFile(target).toString()).put("mime",mime))}catch(_:Exception){target.delete()}
      }
      val item=JSONObject().put("id",id).put("text",intent.getStringExtra(Intent.EXTRA_TEXT)?.take(100000) ?: "").put("title",intent.getStringExtra(Intent.EXTRA_SUBJECT)?.take(200) ?: "").put("images",images)
      // Each launch has a durable id; onNewIntent/recreation cannot consume it twice.
      val prefs=Repository.prefs(this);synchronized(ShareActivity::class.java){val queue=JSONArray(prefs.getString("incoming","[]"));if((0 until queue.length()).none{queue.getJSONObject(it).getString("id")==id})queue.put(item);check(prefs.edit().putString("incoming",queue.toString()).commit())}
      Repository.onChange?.invoke()
    }
    runOnUiThread {
      if(!isFinishing)startActivity(packageManager.getLaunchIntentForPackage(packageName)!!.apply{action=Intent.ACTION_VIEW;data=Uri.parse("dayflow:///capture");addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)})
      finish()
    }
    }.start()
  }
}
