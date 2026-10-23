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
    fun ramGb(ctx: Context): Double {
        val mi = ActivityManager.MemoryInfo()
        ctx.getSystemService(ActivityManager::class.java).getMemoryInfo(mi)
        return mi.totalMem / 1024.0 / 1024.0 / 1024.0
    }

    /**
     * Meaning models: they turn a claim and every paragraph into vectors, so a search finds
     * paragraphs that say the same thing in other words or in another language. Every paragraph
     * the phone collects passes through one once, so speed matters on a slow phone. Both found the
     * right paragraphs in the comparison workflow (research-app-models.yml); e5-small read a full
     * paragraph about three times faster. It is converted from its publisher's files by
     * research-app-model-files.yml and kept in this repository's releases.
     */
    val embedders = listOf(
        ModelInfo(
            "e5-small", "multilingual-e5-small (hızlı)", "4 GB'lık telefonlar için (ör. Redmi Note 8). Paragrafları en hızlı " +
                "işleyen anlam modeli; yayımcısının (intfloat) dosyalarından bu uygulama için dönüştürüldü.",
            "https://github.com/editor-cell/editor-cell.github.io/releases/download/models-1/multilingual-e5-small-q8_0.gguf", 126, 2,
        ),
        ModelInfo(
            "embeddinggemma", "EmbeddingGemma 300M (isabetli)", "6 GB ve üstü bellekli telefonlar için. Daha isabetli, " +
                "ama her paragrafı işlemesi yaklaşık üç kat uzun sürer.",
            "https://huggingface.co/ggml-org/embeddinggemma-300M-GGUF/resolve/main/embeddinggemma-300M-Q8_0.gguf", 330, 6,
        ),
    )

    fun recommendedEmbedder(ctx: Context): ModelInfo = if (ramGb(ctx) >= 5.5) embedders[1] else embedders[0]

    /** The meaning model the owner chose, or the one this phone's memory suggests. */
    fun embedder(ctx: Context): ModelInfo = embedders.firstOrNull { it.id == Settings.embedderId(ctx) } ?: recommendedEmbedder(ctx)

    /** A model file that is fully downloaded. */
    fun ready(ctx: Context, m: ModelInfo): Boolean {
        val f = file(ctx, m)
        return f.exists() && m.id !in pending(ctx) && f.length() > m.sizeMb * 1024L * 1024L * 85 / 100
    }

    fun embedderPath(ctx: Context): String? = embedder(ctx).let { if (ready(ctx, it)) file(ctx, it).path else null }

    fun dir(ctx: Context): File = File(ctx.getExternalFilesDir(null) ?: ctx.filesDir, "models").apply { mkdirs() }

    fun file(ctx: Context, m: ModelInfo) = File(dir(ctx), m.fileName)

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
    fun pending(ctx: Context): Map<String, Long> = embedders.mapNotNull { m ->
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
