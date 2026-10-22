package com.dayflow.nativecore

import android.app.*
import android.content.*
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.*
import android.provider.Settings
import android.view.*
import android.widget.*
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import org.json.JSONObject
import java.lang.ref.WeakReference

class OverlaySyncService: HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? = if(BubbleService.active) HeadlessJsTaskConfig("DayflowOverlaySync",Arguments.createMap(),0,true) else null
  override fun onStartCommand(intent: Intent?,flags: Int,startId: Int): Int {super.onStartCommand(intent,flags,startId);return START_NOT_STICKY}
}

class BubbleService: Service() {
  companion object {
    private var current=WeakReference<BubbleService>(null)
    var active=false;private set
    var appVisible=false
    fun needsSync(c: Context)=active && !appVisible && c.getSystemService(PowerManager::class.java).isInteractive && !c.getSystemService(KeyguardManager::class.java).isKeyguardLocked
    fun refreshCurrent(){current.get()?.let {s->Handler(Looper.getMainLooper()).post {s.refresh()} }}
  }
  private lateinit var windows: WindowManager
  private var bubble: TextView?=null
  private var panel: LinearLayout?=null
  private var panelParams: WindowManager.LayoutParams?=null
  private val handler=Handler(Looper.getMainLooper())
  private var syncStarted=false
  private val screenReceiver=object: BroadcastReceiver(){override fun onReceive(c: Context,i: Intent){refresh()}}
  private fun dp(v: Int)=(v*resources.displayMetrics.density).toInt()
  private fun background(color: Int)=GradientDrawable().apply{setColor(color);cornerRadius=dp(20).toFloat()}
  private fun label(value: String,size: Float=16f)=TextView(this).apply{text=value;textSize=size;setTextColor(Color.rgb(17,24,39));setPadding(dp(12),dp(10),dp(12),dp(10))}
  override fun onBind(i: Intent?): IBinder?=null
  override fun onConfigurationChanged(config: android.content.res.Configuration){super.onConfigurationChanged(config);removeBubble();refresh()}
  override fun onCreate(){super.onCreate();windows=getSystemService(WindowManager::class.java);current=WeakReference(this);val filter=IntentFilter().apply{addAction(Intent.ACTION_SCREEN_OFF);addAction(Intent.ACTION_USER_PRESENT)};ContextCompat.registerReceiver(this,screenReceiver,filter,ContextCompat.RECEIVER_NOT_EXPORTED)}
  override fun onStartCommand(i: Intent?,flags: Int,startId: Int): Int {
    if(i?.action=="stop" || !Settings.canDrawOverlays(this) || Repository.active(this)==null){stopSelf();return START_NOT_STICKY}
    NativeSurfaces.channels(this)
    val stop=PendingIntent.getService(this,0,Intent(this,BubbleService::class.java).setAction("stop"),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val notification=NotificationCompat.Builder(this,NativeSurfaces.OVERLAY).setSmallIcon(android.R.drawable.ic_menu_edit).setContentTitle("Dayflow floating panel").setContentText("Tap to open Dayflow. Stop to hide the bubble.").setContentIntent(NativeSurfaces.open(this)).setOngoing(true).addAction(0,"Stop",stop).build()
    if(Build.VERSION.SDK_INT>=34)startForeground(2401,notification,android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE) else startForeground(2401,notification)
    active=true;Repository.prefs(this).edit().putBoolean("bubbleWanted",true).apply();refresh()
    return START_NOT_STICKY
  }
  private fun removePanel(){panel?.let{runCatching{windows.removeView(it)}};panel=null}
  private fun removeBubble(){bubble?.let{runCatching{windows.removeView(it)}};bubble=null;removePanel()}
  fun refresh(){
    if(active && (Repository.active(this)==null || !Settings.canDrawOverlays(this))){stopSelf();return}
    val shouldSync=needsSync(this)
    if(shouldSync && !syncStarted){syncStarted=true;startService(Intent(this,OverlaySyncService::class.java))}
    if(!shouldSync && syncStarted){syncStarted=false;stopService(Intent(this,OverlaySyncService::class.java))}
    val locked=getSystemService(KeyguardManager::class.java).isKeyguardLocked
    if(!active || appVisible || locked || !getSystemService(PowerManager::class.java).isInteractive || Repository.active(this)==null || !Settings.canDrawOverlays(this)){removeBubble();return}
    if(bubble==null)showBubble()
    if(panel!=null)renderPanel()
  }
  private fun showBubble(){
    val metrics=resources.displayMetrics;val prefs=Repository.prefs(this)
    val params=WindowManager.LayoutParams(dp(56),dp(56),WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,PixelFormat.TRANSLUCENT).apply{gravity=Gravity.TOP or Gravity.LEFT;x=prefs.getInt("bubbleX",metrics.widthPixels-dp(64)).coerceIn(0,maxOf(0,metrics.widthPixels-dp(56)));y=prefs.getInt("bubbleY",dp(160)).coerceIn(dp(30),maxOf(dp(30),metrics.heightPixels-dp(90)))}
    val view=label("D",23f).apply{gravity=Gravity.CENTER;contentDescription="Open Dayflow task panel";setTextColor(Color.WHITE);background=background(Color.rgb(30,41,59));elevation=dp(8).toFloat()}
    view.importantForAccessibility=View.IMPORTANT_FOR_ACCESSIBILITY_YES
    view.setOnClickListener{if(panel==null)showPanel() else removePanel()}
    var startX=0;var startY=0;var rawX=0f;var rawY=0f;var moved=false
    view.setOnTouchListener{_,event->when(event.action){
      MotionEvent.ACTION_DOWN->{startX=params.x;startY=params.y;rawX=event.rawX;rawY=event.rawY;moved=false;true}
      MotionEvent.ACTION_MOVE->{val dx=(event.rawX-rawX).toInt();val dy=(event.rawY-rawY).toInt();if(kotlin.math.abs(dx)+kotlin.math.abs(dy)>dp(6))moved=true;params.x=(startX+dx).coerceIn(0,maxOf(0,metrics.widthPixels-dp(56)));params.y=(startY+dy).coerceIn(dp(30),maxOf(dp(30),metrics.heightPixels-dp(90)));runCatching{windows.updateViewLayout(view,params)};true}
      MotionEvent.ACTION_UP->{params.x=if(params.x<metrics.widthPixels/2)dp(4) else metrics.widthPixels-dp(60);prefs.edit().putInt("bubbleX",params.x).putInt("bubbleY",params.y).apply();runCatching{windows.updateViewLayout(view,params)};if(!moved)view.performClick();true}
      else->false
    }}
    runCatching{windows.addView(view,params);bubble=view}.onFailure{stopSelf()}
  }
  private fun showPanel(){
    val metrics=resources.displayMetrics
    val p=WindowManager.LayoutParams(minOf(dp(360),metrics.widthPixels-dp(24)),minOf(dp(520),metrics.heightPixels-dp(160)),WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,0,PixelFormat.TRANSLUCENT).apply{gravity=Gravity.CENTER;softInputMode=WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE}
    panel=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;background=background(Color.rgb(248,249,251));elevation=dp(12).toFloat();setPadding(dp(8),dp(8),dp(8),dp(8))};panelParams=p
    runCatching{windows.addView(panel,p);renderPanel()}.onFailure{panel=null}
  }
  private fun renderPanel(){
    val root=panel ?: return;val user=Repository.active(this) ?: return;val repo=Repository.get(this,user)
    if(root.childCount==0) {
      val top=LinearLayout(this);top.addView(label("Today",20f),LinearLayout.LayoutParams(0,dp(48),1f));top.addView(label("Expand").apply{setOnClickListener{NativeSurfaces.open(this@BubbleService).send();removePanel()}});top.addView(label("×").apply{contentDescription="Close task panel";setOnClickListener{removePanel()}});root.addView(top)
      root.addView(label("",12f).apply{tag="syncStatus"})
      val list=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;tag="taskList"};val scroll=ScrollView(this);scroll.addView(list);root.addView(scroll,LinearLayout.LayoutParams(-1,0,1f))
      val input=EditText(this).apply{hint="Quick task title";tag="quickAdd";setSingleLine();setTextColor(Color.BLACK);setHintTextColor(Color.GRAY)};root.addView(input)
      root.addView(label("＋ Add task").apply{setOnClickListener{if(input.text.toString().trim().isNotBlank()){val title=input.text.toString().take(200);input.setText("");repo.mutate("task",JSONObject().put("title",title))}}})
    }
    root.findViewWithTag<TextView>("syncStatus").text=repo.meta("syncState") ?: "Saved on this device"
    val list=root.findViewWithTag<LinearLayout>("taskList");list.removeAllViews()
    val docs=repo.list("task");val rows=(0 until docs.length()).map{docs.getJSONObject(it)}.filter{it.isNull("deletedAt") && it.optString("taskDate")==Repository.today()}.sortedBy{it.optDouble("orderIndex")}
    for(d in rows){val id=d.getString("id");val row=LinearLayout(this);row.addView(label(d.getString("title")).apply{setOnClickListener{NativeSurfaces.open(this@BubbleService,"editor?entity=task&id=$id").send()}},LinearLayout.LayoutParams(0,-2,1f));row.addView(label(if(d.getString("status")=="completed")"↺" else "✓").apply{contentDescription="Change task status";setOnClickListener{repo.mutate("task",JSONObject().put("id",id).put("status",if(d.getString("status")=="completed")"notStarted" else "completed"))}});list.addView(row)}
  }
  override fun onDestroy(){active=false;Repository.prefs(this).edit().putBoolean("bubbleWanted",false).apply();removeBubble();unregisterReceiver(screenReceiver);stopService(Intent(this,OverlaySyncService::class.java));current.clear();super.onDestroy()}
}
