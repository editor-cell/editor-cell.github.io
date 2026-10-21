package com.orbis.research

import android.app.DownloadManager
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

@Composable
fun CollectScreen() {
    val ctx = LocalContext.current
    val db = remember { Db.get(ctx) }
    val text by Progress.text.collectAsState()
    val running by Progress.running.collectAsState()
    var totals by remember { mutableStateOf(0 to 0) }
    var sourceCount by remember { mutableIntStateOf(0) }
    var perSource by remember { mutableFloatStateOf(Settings.perSource(ctx).toFloat()) }
    var candidates by remember { mutableFloatStateOf(Settings.candidates(ctx).toFloat()) }
    var daily by remember { mutableStateOf(Settings.daily(ctx)) }

    LaunchedEffect(running, text) {
        withContext(Dispatchers.IO) { totals = db.totals(); sourceCount = db.sources().size }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Belge toplama", style = MaterialTheme.typography.headlineSmall)
        Text(
            "Uygulama $sourceCount kaynağın yayın akışlarına, site haritalarına ve ana sayfalarına bakar; " +
                "yeni ve eski belgeleri, en yeniden başlayarak telefona alır. Listede olmayan hiçbir siteye gitmez.",
            style = MaterialTheme.typography.bodySmall,
        )
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(14.dp)) {
                Text("Telefonda ${totals.first} belge, ${totals.second} paragraf var.", style = MaterialTheme.typography.titleMedium)
                if (running) LinearProgressIndicator(Modifier.fillMaxWidth().padding(vertical = 8.dp))
                if (text.isNotEmpty()) Text(text, style = MaterialTheme.typography.bodySmall)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { CollectWorker.start(ctx) }, enabled = !running && sourceCount > 0) { Text("Şimdi topla") }
            OutlinedButton(onClick = { CollectWorker.stop(ctx) }, enabled = running) { Text("Durdur") }
        }
        Text("Her toplamada kaynak başına en çok ${perSource.toInt()} belge okunur. Sıradakiler bir sonraki toplamada gelir.")
        Slider(perSource, { perSource = it }, valueRange = 10f..300f, steps = 28,
            onValueChangeFinished = { Settings.setPerSource(ctx, perSource.toInt()) })
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Her gün kendiliğinden topla (Wi-Fi'da, şarj yeterliyken)", Modifier.weight(1f))
            Switch(daily, { daily = it; Settings.setDaily(ctx, it); CollectWorker.setDaily(ctx, it) })
        }
        Text("Bir aramada model en uygun ${candidates.toInt()} paragrafı okur. Daha çok paragraf daha uzun sürer.")
        Slider(candidates, { candidates = it }, valueRange = 10f..100f, steps = 17,
            onValueChangeFinished = { Settings.setCandidates(ctx, candidates.toInt()) })
    }
}

@Composable
fun ModelScreen() {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val ram = remember { Models.ramGb(ctx) }
    val rec = remember { Models.recommended(ctx) }
    var current by remember { mutableStateOf(Settings.modelPath(ctx)) }
    var installed by remember { mutableStateOf(Models.installed(ctx)) }
    var downloads by remember { mutableStateOf(Models.pending(ctx)) }
    var progress by remember { mutableStateOf(mapOf<String, Float>()) }

    // Follow running downloads; a finished file becomes the chosen model if none is chosen yet.
    LaunchedEffect(downloads) {
        while (downloads.isNotEmpty()) {
            val next = HashMap<String, Float>()
            val still = HashMap<String, Long>()
            for ((id, dl) in downloads) {
                val st = Models.status(ctx, dl)
                when (if (st == null) DownloadManager.STATUS_FAILED else st.third) {
                    DownloadManager.STATUS_SUCCESSFUL -> {
                        installed = Models.installed(ctx)
                        val m = Models.all.first { it.id == id }
                        if (current == null) { current = Models.file(ctx, m).path; Settings.setModelPath(ctx, current) }
                    }
                    DownloadManager.STATUS_FAILED -> Toast.makeText(ctx, "İndirme yarım kaldı; yeniden deneyin.", Toast.LENGTH_LONG).show()
                    else -> { still[id] = dl; next[id] = if (st!!.second > 0) st.first.toFloat() / st.second else 0f }
                }
            }
            progress = next
            if (still.size != downloads.size) { downloads = still; break }
            delay(1000)
        }
    }

    LaunchedEffect(Unit) {
        if (current == null || !File(current!!).exists()) {
            val first = Models.all.map { Models.file(ctx, it) to it }.firstOrNull { (f, m) -> f.length() > m.sizeMb * 1024L * 1024L * 85 / 100 }
            current = first?.first?.path
            Settings.setModelPath(ctx, current)
        }
    }

    val pick = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) scope.launch {
            Toast.makeText(ctx, "Dosya kopyalanıyor…", Toast.LENGTH_SHORT).show()
            val ok = withContext(Dispatchers.IO) {
                try {
                    val name = (uri.lastPathSegment ?: "model").substringAfterLast('/').substringAfterLast(':')
                        .let { if (it.endsWith(".gguf")) it else "$it.gguf" }
                    val out = File(Models.dir(ctx), name)
                    ctx.contentResolver.openInputStream(uri)?.use { i -> out.outputStream().use { o -> i.copyTo(o, 1 shl 20) } }
                    out.path
                } catch (e: Exception) { null }
            }
            if (ok == null) Toast.makeText(ctx, "Dosya alınamadı.", Toast.LENGTH_LONG).show()
            else { installed = Models.installed(ctx); current = ok; Settings.setModelPath(ctx, ok); Llm.release() }
        }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Yapay zekâ modeli", style = MaterialTheme.typography.headlineSmall)
        Text(
            "Model telefonun içinde çalışır; internete, bir hizmete ya da ücrete ihtiyaç duymaz. " +
                "Bir kez indirilir (Wi-Fi önerilir). Bu telefonda %.1f GB bellek var; önerilen: %s.".format(ram, rec.title),
            style = MaterialTheme.typography.bodySmall,
        )
        for (m in Models.all) {
            val file = Models.file(ctx, m)
            // A file still being written is not counted until it reaches its full size.
            val have = installed.any { it.path == file.path } && m.id !in downloads && file.length() > m.sizeMb * 1024L * 1024L * 85 / 100
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        RadioButton(selected = current == file.path, enabled = have, onClick = {
                            current = file.path; Settings.setModelPath(ctx, file.path); scope.launch { Llm.release() }
                        })
                        Column(Modifier.weight(1f)) {
                            Text(m.title + if (m == rec) " · bu telefon için önerilen" else "", style = MaterialTheme.typography.titleMedium)
                            Text("${m.note} Yaklaşık ${m.sizeMb} MB.", style = MaterialTheme.typography.bodySmall)
                            if (ram < m.minRamGb - 0.6) Text("Bu telefonun belleği bu model için az olabilir.", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                    progress[m.id]?.let { p -> LinearProgressIndicator(progress = { p }, modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp)) }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (!have && m.id !in downloads) TextButton(onClick = { downloads = downloads + (m.id to Models.download(ctx, m)) }) { Text("İndir") }
                        if (have) TextButton(onClick = {
                            scope.launch { Llm.release() }
                            file.delete(); installed = Models.installed(ctx)
                            if (current == file.path) { current = null; Settings.setModelPath(ctx, null) }
                        }) { Text("Sil", color = MaterialTheme.colorScheme.error) }
                    }
                }
            }
        }
        val others = installed.filter { f -> Models.all.none { Models.file(ctx, it).path == f.path } }
        for (f in others) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                RadioButton(selected = current == f.path, onClick = { current = f.path; Settings.setModelPath(ctx, f.path); scope.launch { Llm.release() } })
                Text(f.name, Modifier.weight(1f))
                TextButton(onClick = { f.delete(); installed = Models.installed(ctx); if (current == f.path) { current = null; Settings.setModelPath(ctx, null) } }) { Text("Sil") }
            }
        }
        OutlinedButton(onClick = { pick.launch(arrayOf("*/*")) }) { Text("Telefondaki bir model dosyasını seç (.gguf)") }
    }
}
