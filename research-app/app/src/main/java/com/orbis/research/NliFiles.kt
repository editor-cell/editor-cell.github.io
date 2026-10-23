package com.orbis.research

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.io.File
import java.security.KeyStore
import java.security.MessageDigest
import java.util.zip.ZipInputStream
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Verified private model downloads. No credential is part of the APK or a public release. */
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

    private fun secret(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getEntry("orbis-hf-read", null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder("orbis-hf-read", KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }

    fun saveToken(ctx: Context, value: String) {
        require(value.trim().startsWith("hf_") && value.trim().none { it.isWhitespace() }) { "Geçerli bir Hugging Face okuma anahtarı girin." }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, secret()) }
        val encrypted = cipher.doFinal(value.trim().toByteArray(Charsets.UTF_8))
        prefs(ctx).edit().putString("token", Base64.encodeToString(cipher.iv, Base64.NO_WRAP) + "." + Base64.encodeToString(encrypted, Base64.NO_WRAP)).apply()
    }

    fun hasToken(ctx: Context) = prefs(ctx).contains("token")
    fun forgetToken(ctx: Context) { prefs(ctx).edit().remove("token").apply() }
    private fun token(ctx: Context): String? = try {
        val parts = prefs(ctx).getString("token", null)?.split('.')
        if (parts == null || parts.size != 2) null else {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply {
                init(Cipher.DECRYPT_MODE, secret(), GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)))
            }
            String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), Charsets.UTF_8)
        }
    } catch (_: Exception) { forgetToken(ctx); null }

    fun download(ctx: Context): Long {
        val key = token(ctx) ?: error("Özel model için Hugging Face okuma anahtarını girin; ya da model paketini dosyadan yükleyin.")
        val url = manifest(ctx).getString("url")
        require(url.startsWith("https://huggingface.co/orbisthereadingatlas/"))
        cancelDownload(ctx)
        val request = DownloadManager.Request(Uri.parse(url))
            .addRequestHeader("Authorization", "Bearer $key")
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

    /** A package from the phone is accepted only if it is this APK's exact latest-model package. */
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
