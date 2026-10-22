package com.dayflow.nativecore

import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.json.JSONObject
import org.json.JSONArray
import java.util.UUID
import java.time.Instant
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[35])
class RepositoryTest {
  private lateinit var repo: Repository
  @Before fun setup(){val context=RuntimeEnvironment.getApplication();val user=UUID.randomUUID().toString();Repository.prefs(context).edit().putString("account",user).commit();repo=Repository.get(context,user)}
  @Test fun documentAndOutboxCommitTogether(){val task=repo.mutate("task",JSONObject().put("title","Offline task"));assertEquals(Repository.today(),task.getString("taskDate"));assertEquals(1,repo.pendingCount());assertEquals(task.getString("id"),repo.outbox().getJSONObject(0).getString("id"))}
  @Test fun oldAcknowledgementPreservesNewerLocalEdit(){val first=repo.mutate("task",JSONObject().put("title","First"));val queued=repo.outbox().getJSONObject(0);repo.mutate("task",JSONObject().put("id",first.getString("id")).put("title","Newer"));repo.acknowledge(queued.getLong("seq"),"task",first.getString("id"),first.getString("updatedAt"),first);assertEquals("Newer",repo.doc("task",first.getString("id"))!!.getString("title"));assertEquals(1,repo.pendingCount())}
  @Test fun losingLocalEditIsRecoverable(){val first=repo.mutate("note",JSONObject().put("title","Local"));val remote=JSONObject(first.toString()).put("title","Remote").put("updatedAt",Instant.now().plusSeconds(60).toString());repo.applyRemote("note",remote);assertEquals("Remote",repo.doc("note",first.getString("id"))!!.getString("title"));assertEquals("Local",repo.recoveries().getJSONObject(0).getJSONObject("doc").getString("title"))}
  @Test fun fullResetRetainsUnsentNewRecordsAndRecoversMissingAcknowledgedRecords(){val old=repo.mutate("task",JSONObject().put("title","Old"));val row=repo.outbox().getJSONObject(0);repo.acknowledge(row.getLong("seq"),"task",old.getString("id"),old.getString("updatedAt"),old);repo.mutate("task",JSONObject().put("id",old.getString("id")).put("title","Unsynced edit"));val fresh=repo.mutate("task",JSONObject().put("title","Never uploaded"));repo.mergePull(JSONObject().put("tasks",JSONArray()).put("notes",JSONArray()).put("serverTime",Instant.now().toString()),true);assertNull(repo.doc("task",old.getString("id")));assertNotNull(repo.doc("task",fresh.getString("id")));assertEquals(1,repo.recoveries().length());assertEquals(1,repo.pendingCount())}
  @Test fun accountsAndDraftsAreIsolated(){repo.mutate("note",JSONObject().put("title","Private"));repo.setMeta("draft:note:new","draft");val other=Repository.get(RuntimeEnvironment.getApplication(),UUID.randomUUID().toString());assertEquals(0,other.list("note").length());assertNull(other.meta("draft:note:new"))}
  @Test fun invalidMutationDoesNotQueue(){try{repo.mutate("task",JSONObject().put("title","").put("status","invalid"));fail("Expected validation")}catch(_:IllegalArgumentException){};assertEquals(0,repo.pendingCount());assertEquals(0,repo.list("task").length())}
  @Test fun concurrentNativeWritersKeepEveryDocumentAndOutboxEntry(){
    val pool=Executors.newFixedThreadPool(4)
    try {
      val writes=(1..24).map{number->pool.submit<String>{repo.mutate("task",JSONObject().put("title","Action $number")).getString("id")}}
      assertEquals(24,writes.map{it.get(20,TimeUnit.SECONDS)}.toSet().size)
      assertEquals(24,repo.list("task").length());assertEquals(24,repo.pendingCount());assertEquals(24,repo.outbox().length())
    }finally{pool.shutdownNow()}
  }
  @Test fun uploadedImageRemainsDurableWhileAnEditorDraftReferencesIt(){
    val id=UUID.randomUUID().toString();val image=UUID.randomUUID().toString();val context=RuntimeEnvironment.getApplication()
    val file=File(context.filesDir,"images/${repo.user}/$image");file.parentFile!!.mkdirs();file.writeText("image fixture")
    repo.putUpload(JSONObject().put("localId",image).put("entity","task").put("entityId",id).put("uri",file.toURI().toString()).put("mime","image/png"))
    val html="<img src=\"local:$image\" data-local-id=\"$image\">"
    repo.mutate("task",JSONObject().put("id",id).put("title","Image task").put("descriptionHtml",html))
    repo.setMeta("draft:task:$id",JSONObject().put("id",id).put("html",html).toString())
    repo.completeUpload(image,"/uploads/${repo.user}/image.webp")
    val queued=repo.outbox().getJSONObject(0);val sent=queued.getJSONObject("doc")
    assertFalse(sent.getString("descriptionHtml").contains("data-local-id"))
    repo.acknowledge(queued.getLong("seq"),"task",id,sent.getString("updatedAt"),sent)
    assertTrue(file.exists());assertEquals(1,repo.uploads().length())
    repo.setMeta("draft:task:$id",null)
    assertFalse(file.exists());assertEquals(0,repo.uploads().length())
  }
  @Test fun changingStatusAppendsToTheDestinationSection(){
    val moving=repo.mutate("task",JSONObject().put("title","Move me").put("orderIndex",10))
    repo.mutate("task",JSONObject().put("title","Started peer").put("status","started").put("orderIndex",2048))
    val changed=repo.mutate("task",JSONObject().put("id",moving.getString("id")).put("status","started"))
    assertEquals(3072.0,changed.getDouble("orderIndex"),0.0)
  }
}
