package com.dayflow.nativecore

import android.app.NotificationManager
import android.content.Intent
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.time.Instant
import java.util.UUID

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[32])
class ReminderTest {
  private val context get()=RuntimeEnvironment.getApplication()
  private lateinit var repo: Repository
  @Before fun setup(){val user=UUID.randomUUID().toString();Repository.prefs(context).edit().putString("account",user).commit();repo=Repository.get(context,user);context.getSystemService(NotificationManager::class.java).cancelAll()}
  private fun task(secondsAgo: Long=5)=repo.mutate("task",JSONObject().put("title","Offline reminder").put("reminderAt",Instant.now().minusSeconds(secondsAgo).toString()))
  private fun receive(action: String,task: JSONObject,user: String=repo.user){ReminderReceiver().onReceive(context,Intent(action).putExtra("user",user).putExtra("id",task.getString("id")).putExtra("at",task.getString("reminderAt")))}
  @Test fun deliveredReminderDoesNotNotifyAgainAfterDismissal(){
    val task=task();receive("fire",task)
    val manager=context.getSystemService(NotificationManager::class.java)
    assertEquals(1,manager.activeNotifications.size)
    assertTrue(repo.delivered("${task.getString("id")}:${task.getString("reminderAt")}"))
    manager.cancelAll();receive("fire",task);assertEquals(0,manager.activeNotifications.size)
  }
  @Test fun snoozeQueuesTenMinuteUpdateAndDismissesNotification(){
    val task=task();receive("fire",task);val before=Instant.now();receive("snooze",task)
    val reminder=Instant.parse(repo.doc("task",task.getString("id"))!!.getString("reminderAt"))
    assertTrue(reminder>=before.plusSeconds(599));assertTrue(reminder<=Instant.now().plusSeconds(601))
    assertEquals(0,context.getSystemService(NotificationManager::class.java).activeNotifications.size)
    assertEquals(1,repo.pendingCount())
  }
  @Test fun completionUsesTheRepositoryAndCancelsReminder(){
    val task=task();receive("fire",task);receive("complete",task)
    assertEquals("completed",repo.doc("task",task.getString("id"))!!.getString("status"))
    assertEquals(0,context.getSystemService(NotificationManager::class.java).activeNotifications.size)
  }
  @Test fun staleOrWrongAccountAlarmsDoNotNotify(){
    receive("fire",task(3600));receive("fire",task(),UUID.randomUUID().toString())
    assertEquals(0,context.getSystemService(NotificationManager::class.java).activeNotifications.size)
  }
}
