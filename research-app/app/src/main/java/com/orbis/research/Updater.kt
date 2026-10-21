package com.orbis.research

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings as AndroidSettings
import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * Updates the app from its own release page: a newer APK is downloaded and installed over this
 * one, so the models, sources and documents on the phone stay. The release page is this app's
 * own address, not a source, so it does not go through [Net].
 */
object Updater {
    private const val RELEASES = "https://api.github.com/repos/editor-cell/editor-cell.github.io/releases?per_page=100"
    private const val APK = "orbis-arastirma.apk"
    private val TAG = Regex("^arastirma-v0\\.1\\.(\\d+)$")

    class Release(val number: Int, val url: String)

    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS).readTimeout(60, TimeUnit.SECONDS).build()

    fun current(ctx: Context): Long = ctx.packageManager.getPackageInfo(ctx.packageName, 0).longVersionCode

    /** The newest release above the installed one, or null (also when the phone is offline). */
    fun newer(ctx: Context): Release? = try {
        val req = Request.Builder().url(RELEASES).header("Accept", "application/vnd.github+json")
            .header("User-Agent", Net.USER_AGENT).build()
        client.newCall(req).execute().use { r ->
            if (!r.isSuccessful) return null
            val list = JSONArray(r.body?.string() ?: return null)
            var best: Release? = null
            for (i in 0 until list.length()) {
                val rel = list.getJSONObject(i)
                if (rel.optBoolean("draft") || rel.optBoolean("prerelease")) continue
                val n = TAG.find(rel.optString("tag_name"))?.groupValues?.get(1)?.toIntOrNull() ?: continue
                val assets = rel.optJSONArray("assets") ?: continue
                for (j in 0 until assets.length()) {
                    val a = assets.getJSONObject(j)
                    if (a.optString("name") == APK && (best == null || n > best.number)) best = Release(n, a.optString("browser_download_url"))
                }
            }
            best?.takeIf { it.number > current(ctx) }
        }
    } catch (e: Exception) { null }

    /** Downloads the APK into the app's own folder; [progress] gets 0..1, or -1 while the size is unknown. */
    fun download(ctx: Context, r: Release, progress: (Float) -> Unit): File? {
        val dir = File(ctx.cacheDir, "update").apply { mkdirs(); listFiles()?.forEach { it.delete() } }
        val file = File(dir, "orbis-arastirma-${r.number}.apk")
        return try {
            client.newBuilder().readTimeout(120, TimeUnit.SECONDS).build()
                .newCall(Request.Builder().url(r.url).header("User-Agent", Net.USER_AGENT).build()).execute().use { resp ->
                    if (!resp.isSuccessful) return null
                    val body = resp.body ?: return null
                    val total = body.contentLength()
                    body.byteStream().use { input ->
                        file.outputStream().use { out ->
                            val buf = ByteArray(256 * 1024)
                            var done = 0L
                            while (true) {
                                val n = input.read(buf)
                                if (n < 0) break
                                out.write(buf, 0, n)
                                done += n
                                progress(if (total > 0) done.toFloat() / total else -1f)
                            }
                        }
                    }
                }
            file.takeIf { it.length() > 0 }
        } catch (e: Exception) { null }
    }

    /** True when the phone already lets this app install updates. */
    fun canInstall(ctx: Context) = ctx.packageManager.canRequestPackageInstalls()

    /** Opens the phone's setting that lets this app install updates (asked once). */
    fun askPermission(ctx: Context) {
        ctx.startActivity(
            Intent(AndroidSettings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.packageName))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }

    /** Hands the APK to the phone's installer, which installs it over this app. */
    fun install(ctx: Context, apk: File) {
        val uri = FileProvider.getUriForFile(ctx, ctx.packageName + ".files", apk)
        ctx.startActivity(
            Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }
}

/** Shown at the top while a newer version is waiting on the release page. */
@Composable
fun UpdateBanner() {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var release by remember { mutableStateOf<Updater.Release?>(null) }
    var progress by remember { mutableStateOf<Float?>(null) }
    var hidden by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { release = withContext(Dispatchers.IO) { Updater.newer(ctx.applicationContext) } }
    val r = release ?: return
    if (hidden) return
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        Column(Modifier.padding(12.dp)) {
            Text("Yeni sürüm var (0.1.${r.number}).", style = MaterialTheme.typography.titleSmall)
            Text(
                "Güncelleme bu sürümün üstüne kurulur; modeller, kaynaklar ve toplanan belgeler yerinde kalır.",
                style = MaterialTheme.typography.bodySmall,
            )
            val p = progress
            if (p != null) {
                if (p < 0f) LinearProgressIndicator(Modifier.fillMaxWidth().padding(top = 8.dp))
                else LinearProgressIndicator(progress = { p }, modifier = Modifier.fillMaxWidth().padding(top = 8.dp))
                Text("İndiriliyor…", style = MaterialTheme.typography.bodySmall)
            } else Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 6.dp)) {
                Button(onClick = {
                    if (!Updater.canInstall(ctx)) {
                        Toast.makeText(ctx, "Açılan ayarda \"Bu kaynaktan izin ver\"i açıp geri dönün, sonra yeniden Güncelle'ye dokunun.", Toast.LENGTH_LONG).show()
                        Updater.askPermission(ctx)
                        return@Button
                    }
                    progress = -1f
                    scope.launch {
                        val apk = withContext(Dispatchers.IO) { Updater.download(ctx.applicationContext, r) { v -> progress = v } }
                        progress = null
                        if (apk == null) Toast.makeText(ctx, "Güncelleme indirilemedi; internet bağlantısını deneyin.", Toast.LENGTH_SHORT).show()
                        else Updater.install(ctx, apk)
                    }
                }) { Text("Güncelle") }
                TextButton(onClick = { hidden = true }) { Text("Sonra") }
            }
        }
    }
}
