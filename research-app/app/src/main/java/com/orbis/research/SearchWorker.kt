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
        val previous = db.run() ?: return Result.success()
        if (previous.state != Db.RUN_GOING) return Result.success()
        val marker = Nli.MODEL_ID
        val prefs = ctx.getSharedPreferences("search-model", Context.MODE_PRIVATE)
        val run = if (prefs.getString("current", null) != marker) {
            // Saved answers from a previous model are never mixed with this trial.
            db.newRun(previous.claim, previous.range, previous.sourceIds)
            prefs.edit().putString("current", marker).apply()
            db.run() ?: return Result.success()
        } else previous
        fun current() = db.run()?.let { it.startedAt == run.startedAt && it.state == Db.RUN_GOING } == true
        suspend fun say(text: String) {
            SearchState.say(text)
            try { setForeground(foregroundInfo(text)) } catch (e: Exception) { }
        }
        try { setForeground(foregroundInfo("Aranıyor…")) } catch (e: Exception) { }
        Nli.allow()
        SearchState.changed()
        var modelAcquired = false
        SearchState.working.value = true
        try {
            say("Cloudflare üzerinden DeepSeek'e bağlanılıyor…")
            Nli.ensure(ctx)
            modelAcquired = true
            val search = Search(ctx)
            if (!run.prepared) {
                if (!search.prepare(run, { say(it) }, { isStopped || !current() })) return Result.success()
                SearchState.changed()
            }
            val pending = db.pendingItems()
            val total = db.run()?.total ?: pending.size
            val started = System.currentTimeMillis()
            for ((n, item) in pending.withIndex()) {
                if (isStopped || !current()) break
                val left = if (n >= 2) ((System.currentTimeMillis() - started) / n * (pending.size - n) / 1000).toInt() else -1
                say("DeepSeek: paragraf ${total - pending.size + n + 1}/$total okunuyor…" + if (left >= 0) " (yaklaşık ${duration(left)} kaldı)" else "")
                val answer = search.judge(run.claim, item.second)
                if (answer == null || isStopped || !current()) break
                db.saveAnswer(item.first, answer, run.startedAt)
                SearchState.changed()
            }
            if (isStopped || !current()) return Result.success()
            if (current()) db.setRun(state = Db.RUN_DONE)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Throwable) {
            if (current()) db.setRun(state = Db.RUN_FAILED, message = "Bir hata oldu: ${e.message}")
        } finally {
            if (modelAcquired) kotlinx.coroutines.withContext(kotlinx.coroutines.NonCancellable) { Nli.release() }
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
