package com.orbis.research

import android.app.ActivityManager
import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import java.io.File

/**
 * Free, open models (Apache 2.0) that run on a phone. They are fetched once from Hugging Face,
 * the only address outside the source list the app ever opens, and only when the owner asks.
 */
data class ModelInfo(val id: String, val title: String, val note: String, val url: String, val sizeMb: Int, val minRamGb: Int) {
    val fileName get() = url.substringAfterLast('/')
}

object Models {
    // Chosen by the comparison workflow (research-app-models.yml): the app's own prompts on five
    // Turkish claims and eight paragraphs. Qwen2.5 1.5B mistranslated Turkish and is not offered.
    // The app suggests the largest one the phone's memory holds; the owner can pick any.
    val all = listOf(
        ModelInfo(
            "qwen3-4b", "Qwen3 4B (büyük)", "En isabetlisi: denemelerde her çeviriyi ve her paragrafı doğru yaptı. " +
                "6 GB ve üstü bellekli telefonlar için; bir paragrafı okuması birkaç saniye sürer.",
            "https://huggingface.co/Qwen/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf", 2500, 6,
        ),
        ModelInfo(
            "qwen3-1.7b", "Qwen3 1.7B (orta)", "4 GB bellekli telefonlar için (ör. Redmi Note 8). Türkçeyi doğru " +
                "çeviriyor; büyük modele göre çürüten paragrafları daha sık kaçırabilir.",
            "https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q4_K_M.gguf", 1100, 3,
        ),
        ModelInfo(
            "qwen3-0.6b", "Qwen3 0.6B (küçük)", "3 GB ve altı bellekli telefonlar için son çare; en hızlısı ama " +
                "en az isabetlisi. Sonuçları özellikle dikkatle okuyun.",
            "https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q4_K_M.gguf", 400, 2,
        ),
    )

    fun ramGb(ctx: Context): Double {
        val mi = ActivityManager.MemoryInfo()
        ctx.getSystemService(ActivityManager::class.java).getMemoryInfo(mi)
        return mi.totalMem / 1024.0 / 1024.0 / 1024.0
    }

    /** The largest model this phone holds comfortably; a "4 GB" phone reports about 3.6 GB. */
    fun recommended(ctx: Context): ModelInfo {
        val ram = ramGb(ctx)
        return when {
            ram >= 5.5 -> all[0]
            ram >= 2.8 -> all[1]
            else -> all[2]
        }
    }

    fun dir(ctx: Context): File = File(ctx.getExternalFilesDir(null) ?: ctx.filesDir, "models").apply { mkdirs() }

    fun file(ctx: Context, m: ModelInfo) = File(dir(ctx), m.fileName)

    fun installed(ctx: Context): List<File> = dir(ctx).listFiles { f -> f.name.endsWith(".gguf") }?.sortedBy { it.name } ?: emptyList()

    fun download(ctx: Context, m: ModelInfo): Long {
        val target = file(ctx, m)
        if (target.exists()) target.delete()
        val req = DownloadManager.Request(Uri.parse(m.url))
            .setTitle("Orbis Araştırma: ${m.title}")
            .setDescription("Yapay zekâ modeli indiriliyor")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationUri(Uri.fromFile(target))
            .setAllowedOverMetered(true)
        val dm = ctx.getSystemService(DownloadManager::class.java)
        pending(ctx)[m.id]?.let { dm.remove(it) }
        val id = dm.enqueue(req)
        prefs(ctx).edit().putLong(m.id, id).apply()
        return id
    }

    private fun prefs(ctx: Context) = ctx.getSharedPreferences("downloads", Context.MODE_PRIVATE)

    /** Downloads started earlier that are still running, by model id; survives leaving the screen. */
    fun pending(ctx: Context): Map<String, Long> = all.mapNotNull { m ->
        val id = prefs(ctx).getLong(m.id, -1L)
        val st = if (id >= 0) status(ctx, id)?.third else null
        if (st == DownloadManager.STATUS_RUNNING || st == DownloadManager.STATUS_PENDING || st == DownloadManager.STATUS_PAUSED) m.id to id else null
    }.toMap()

    /** (downloaded bytes, total bytes, status) of a download, or null if it is unknown. */
    fun status(ctx: Context, id: Long): Triple<Long, Long, Int>? {
        val q = DownloadManager.Query().setFilterById(id)
        ctx.getSystemService(DownloadManager::class.java).query(q).use { c ->
            if (!c.moveToFirst()) return null
            val done = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
            val total = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
            val st = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
            return Triple(done, total, st)
        }
    }
}
