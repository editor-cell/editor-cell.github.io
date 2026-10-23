package com.orbis.research

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import java.util.zip.ZipInputStream

/** Download the pinned trained package from GitHub and verify it before installation. */
object NliFiles {
    fun manifest(ctx: Context): JSONObject = ctx.assets.open("nli_model.json").bufferedReader().use { JSONObject(it.readText()) }
    fun directory(ctx: Context): File = File(ctx.filesDir, "trained-nli-" + manifest(ctx).getString("sha256").take(16))
    private fun prefs(ctx: Context) = ctx.getSharedPreferences("private-nli", Context.MODE_PRIVATE)
    private fun archive(ctx: Context) = File(Models.dir(ctx), "current-trained-nli.zip")
    fun downloadId(ctx: Context): Long? = prefs(ctx).getLong("download", -1).takeIf { it >= 0 }

    fun ready(ctx: Context): Boolean = try {
        val m = manifest(ctx)
        val dir = directory(ctx)
        File(dir, "verified.sha256").readText() == m.getString("sha256") &&
            m.getJSONObject("files").let { files -> files.keys().asSequence().all { name ->
                File(dir, name).length() == files.getJSONObject(name).getLong("bytes")
            } }
    } catch (_: Exception) { false }

    fun download(ctx: Context): Long {
        // Remove a credential saved by an older APK; public downloads need no account.
        prefs(ctx).edit().remove("token").apply()
        val url = manifest(ctx).getString("url")
        require(url.startsWith("https://github.com/editor-cell/editor-cell.github.io/releases/download/android-reader-") && url.endsWith("/android-nli.zip"))
        cancelDownload(ctx)
        val request = DownloadManager.Request(Uri.parse(url))
            .setTitle("Orbis: son eğitilmiş model")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationUri(Uri.fromFile(archive(ctx)))
            .setAllowedOverMetered(true)
        val id = ctx.getSystemService(DownloadManager::class.java).enqueue(request)
        prefs(ctx).edit().putLong("download", id).apply()
        return id
    }

    fun cancelDownload(ctx: Context) {
        downloadId(ctx)?.let { ctx.getSystemService(DownloadManager::class.java).remove(it) }
        prefs(ctx).edit().remove("download").apply()
        archive(ctx).delete()
    }

    fun finishDownload(ctx: Context) { install(ctx, archive(ctx)); cancelDownload(ctx) }

    /** Only this APK's exact latest-model package is accepted. */
    fun install(ctx: Context, source: File) {
        val metadata = manifest(ctx)
        require(source.length() == metadata.getLong("bytes") && hash(source) == metadata.getString("sha256")) {
            "Dosya bu sürümün son model paketi değil ya da indirme tamamlanmamış."
        }
        val target = directory(ctx)
        val temp = File(ctx.filesDir, target.name + ".installing")
        temp.deleteRecursively(); check(temp.mkdirs())
        try {
            val expected = metadata.getJSONObject("files")
            val found = hashSetOf<String>()
            ZipInputStream(source.inputStream().buffered()).use { zip ->
                while (true) {
                    val entry = zip.nextEntry ?: break
                    val name = entry.name
                    require(name in setOf("model.onnx", "tokenizer.json", "encoding.json") && found.add(name) && !entry.isDirectory)
                    val file = File(temp, name)
                    val limit = expected.getJSONObject(name).getLong("bytes")
                    var total = 0L
                    file.outputStream().buffered().use { out ->
                        val buffer = ByteArray(1 shl 20)
                        while (true) {
                            val n = zip.read(buffer)
                            if (n < 0) break
                            total += n; require(total <= limit)
                            out.write(buffer, 0, n)
                        }
                    }
                    require(total == limit && hash(file) == expected.getJSONObject(name).getString("sha256")) { "Model dosyası doğrulanamadı." }
                }
            }
            require(found == setOf("model.onnx", "tokenizer.json", "encoding.json"))
            File(temp, "verified.sha256").writeText(metadata.getString("sha256"))
            target.deleteRecursively()
            check(temp.renameTo(target)) { "Model kurulamadı; depolama alanını kontrol edin." }
            ctx.filesDir.listFiles()?.filter { it.isDirectory && it.name.startsWith("trained-nli-") && it != target }?.forEach { it.deleteRecursively() }
        } finally { temp.deleteRecursively() }
    }

    fun remove(ctx: Context) { directory(ctx).deleteRecursively() }
    private fun hash(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(1 shl 20)
            while (true) { val n = input.read(buffer); if (n < 0) break; digest.update(buffer, 0, n) }
        }
        return digest.digest().joinToString("") { "%02x".format(it.toInt() and 255) }
    }
}
