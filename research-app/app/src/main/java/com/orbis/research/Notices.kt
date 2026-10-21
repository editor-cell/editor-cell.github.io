package com.orbis.research

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.ForegroundInfo

/**
 * The notification a background job shows while it works. It keeps Android (and MIUI) from
 * stopping the job when the owner leaves the app; tapping it opens the app.
 */
fun workNotice(ctx: Context, id: Int, channel: String, channelName: String, text: String): ForegroundInfo {
    val nm = ctx.getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(channel) == null) {
        nm.createNotificationChannel(NotificationChannel(channel, channelName, NotificationManager.IMPORTANCE_LOW))
    }
    val open = PendingIntent.getActivity(
        ctx, id, Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
    val n = NotificationCompat.Builder(ctx, channel)
        .setSmallIcon(android.R.drawable.stat_sys_download)
        .setContentTitle("Orbis Araştırma")
        .setContentText(text)
        .setContentIntent(open)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .build()
    return if (Build.VERSION.SDK_INT >= 29) ForegroundInfo(id, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
    else ForegroundInfo(id, n)
}
