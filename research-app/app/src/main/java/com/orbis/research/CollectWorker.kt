package com.orbis.research

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.core.app.NotificationCompat
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
                Crawler(applicationContext) { isStopped }.run(perSource, only)
                notifier.cancel()
            }
        } finally {
            Progress.running.value = false
        }
        return Result.success()
    }

    override suspend fun getForegroundInfo(): ForegroundInfo = foregroundInfo("Belgeler toplanıyor…")

    private fun foregroundInfo(text: String): ForegroundInfo {
        val nm = applicationContext.getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
            nm.createNotificationChannel(NotificationChannel(CHANNEL, "Belge toplama", NotificationManager.IMPORTANCE_LOW))
        }
        val n = NotificationCompat.Builder(applicationContext, CHANNEL)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentTitle("Orbis Araştırma")
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build()
        return if (Build.VERSION.SDK_INT >= 29) ForegroundInfo(NOTE_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        else ForegroundInfo(NOTE_ID, n)
    }

    companion object {
        private const val CHANNEL = "collect"
        private const val NOTE_ID = 7
        private const val KEY_PER_SOURCE = "perSource"
        private const val KEY_ONLY = "only"
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
