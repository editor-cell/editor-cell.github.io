package com.orbis.research

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.ForegroundInfo
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.CancellationException
import java.io.File

/**
 * Runs the search saved in the database, with a notification, so it goes on when the owner
 * leaves the app. Every answer is saved as it comes; if the phone stops the job, the next start
 * picks up at the first paragraph not yet read.
 */
class SearchWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {

    override suspend fun doWork(): Result {
        val ctx = applicationContext
        val db = Db.get(ctx)
        val run = db.run() ?: return Result.success()
        if (run.state != Db.RUN_GOING) return Result.success()
        fun current() = db.run()?.let { it.startedAt == run.startedAt && it.state == Db.RUN_GOING } == true
        suspend fun say(text: String) {
            SearchState.say(text)
            try { setForeground(foregroundInfo(text)) } catch (e: Exception) { }
        }
        try { setForeground(foregroundInfo("Aranıyor…")) } catch (e: Exception) { }
        Llm.allow()
        SearchState.working.value = true
        try {
            val search = Search(ctx)
            if (!run.prepared) {
                say("Yargıya anlamca en yakın paragraflar bulunuyor…")
                if (!search.prepare(run)) return Result.success()
                SearchState.changed()
            }
            val pending = db.pendingItems()
            if (pending.isNotEmpty()) {
                val path = Settings.modelPath(ctx)
                if (path == null || !File(path).exists()) {
                    db.setRun(state = Db.RUN_FAILED, message = "Önce Model sekmesinden bir dil modeli indirin.")
                    return Result.success()
                }
                say("Model yükleniyor…")
                if (!Llm.ensure(ctx, path)) {
                    db.setRun(state = Db.RUN_FAILED, message = "Model açılamadı; dosya bozuk olabilir. Model sekmesinden yeniden indirin.")
                    return Result.success()
                }
                val total = db.run()?.total ?: pending.size
                val started = System.currentTimeMillis()
                for ((n, item) in pending.withIndex()) {
                    if (isStopped || !current()) break
                    // After the first few paragraphs the phone's own pace gives an honest estimate.
                    val left = if (n >= 2) ((System.currentTimeMillis() - started) / n * (pending.size - n) / 1000).toInt() else -1
                    say("Paragraf ${total - pending.size + n + 1}/$total okunuyor…" + if (left >= 0) " (yaklaşık ${duration(left)} kaldı)" else "")
                    val answer = search.judge(run.claim, item.second)
                    if (answer == null && (isStopped || !current())) break
                    db.saveAnswer(item.first, answer, run.startedAt)
                    SearchState.changed()
                }
            }
            if (isStopped || !current()) return Result.success()
            if (search.findings().none { !it.judgement.indirect }) {
                say("Araştırma için bir yön önerisi hazırlanıyor…")
                search.suggest(run.claim)?.let { if (current()) db.setRun(suggestion = it) }
            }
            if (current()) db.setRun(state = Db.RUN_DONE)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Throwable) {
            if (current()) db.setRun(state = Db.RUN_FAILED, message = "Bir hata oldu: ${e.message}")
        } finally {
            SearchState.working.value = false
            SearchState.say("")
            SearchState.changed()
        }
        return Result.success()
    }

    override suspend fun getForegroundInfo(): ForegroundInfo = foregroundInfo("Aranıyor…")

    private fun foregroundInfo(text: String) = workNotice(applicationContext, NOTE_ID, "search", "Arama", text)

    private fun duration(sec: Int) = if (sec < 60) "$sec sn" else "${(sec + 30) / 60} dk"

    companion object {
        private const val NOTE_ID = 8
        const val NAME = "search"

        fun enqueue(ctx: Context, policy: ExistingWorkPolicy) {
            WorkManager.getInstance(ctx).enqueueUniqueWork(NAME, policy, OneTimeWorkRequestBuilder<SearchWorker>().build())
        }
    }
}
