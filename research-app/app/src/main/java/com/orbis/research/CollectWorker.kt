package com.orbis.research

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.ForegroundInfo
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import kotlinx.coroutines.launch
import kotlinx.coroutines.coroutineScope
import java.util.concurrent.TimeUnit

/** Collects documents in the background, with a notification while it works. */
class CollectWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {

    override suspend fun doWork(): Result {
        val perSource = inputData.getInt(KEY_PER_SOURCE, Settings.perSource(applicationContext))
        val only = inputData.getLongArray(KEY_ONLY)?.toSet()
        try { setForeground(foregroundInfo("Belgeler toplanıyor…")) } catch (e: Exception) { }
        Progress.running.value = true
        try {
            coroutineScope {
                val notifier = launch {
                    Progress.text.collect { t -> if (t.isNotEmpty()) try { setForeground(foregroundInfo(t)) } catch (e: Exception) { } }
                }
                if (!inputData.getBoolean(KEY_INDEX_ONLY, false)) Crawler(applicationContext) { isStopped }.run(perSource, only)
                // Every new paragraph gets its meaning vector before the job ends.
                val indexed = Indexer.run(applicationContext, { isStopped }) { done, left ->
                    Progress.text.value = "Anlam dizini: $done paragraf işlendi, $left kaldı."
                }
                if (indexed && !isStopped) {
                    val (docs, paras) = Db.get(applicationContext).totals()
                    Progress.text.value = "Bitti. Telefonda $docs belge, $paras paragraf var; hepsi anlam dizininde."
                }
                notifier.cancel()
            }
        } finally {
            Progress.running.value = false
        }
        return Result.success()
    }

    override suspend fun getForegroundInfo(): ForegroundInfo = foregroundInfo("Belgeler toplanıyor…")

    private fun foregroundInfo(text: String) = workNotice(applicationContext, NOTE_ID, CHANNEL, "Belge toplama", text)

    companion object {
        private const val CHANNEL = "collect"
        private const val NOTE_ID = 7
        private const val KEY_PER_SOURCE = "perSource"
        private const val KEY_ONLY = "only"
        private const val KEY_INDEX_ONLY = "indexOnly"
        const val NOW = "collect-now"
        const val DAILY = "collect-daily"

        fun start(ctx: Context, only: Collection<Long>? = null) {
            val req = OneTimeWorkRequestBuilder<CollectWorker>()
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setInputData(
                    if (only == null) workDataOf(KEY_PER_SOURCE to Settings.perSource(ctx))
                    else workDataOf(KEY_PER_SOURCE to Settings.perSource(ctx), KEY_ONLY to only.toLongArray()),
                )
                .build()
            WorkManager.getInstance(ctx).enqueueUniqueWork(NOW, ExistingWorkPolicy.KEEP, req)
        }

        /** Gives the paragraphs already on the phone their meaning vectors, without collecting. */
        fun index(ctx: Context) {
            val req = OneTimeWorkRequestBuilder<CollectWorker>()
                .setInputData(workDataOf(KEY_INDEX_ONLY to true))
                .build()
            WorkManager.getInstance(ctx).enqueueUniqueWork(NOW, ExistingWorkPolicy.KEEP, req)
        }

        fun stop(ctx: Context) {
            WorkManager.getInstance(ctx).cancelUniqueWork(NOW)
        }

        /** Once a day, on Wi-Fi, while the battery is not low. */
        fun setDaily(ctx: Context, on: Boolean) {
            val wm = WorkManager.getInstance(ctx)
            if (!on) { wm.cancelUniqueWork(DAILY); return }
            val req = PeriodicWorkRequestBuilder<CollectWorker>(24, TimeUnit.HOURS)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.UNMETERED).setRequiresBatteryNotLow(true).build())
                .build()
            wm.enqueueUniquePeriodicWork(DAILY, ExistingPeriodicWorkPolicy.UPDATE, req)
        }
    }
}
