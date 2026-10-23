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
    var vectors by remember { mutableStateOf(0 to 0) }
    var sourceCount by remember { mutableIntStateOf(0) }
    val hasEmbedder = remember { Models.embedderPath(ctx) != null }
    var perSource by remember { mutableFloatStateOf(Settings.perSource(ctx).toFloat()) }
    var candidates by remember { mutableFloatStateOf(Settings.candidates(ctx).toFloat()) }
    var daily by remember { mutableStateOf(Settings.daily(ctx)) }
    var liveRead by remember { mutableFloatStateOf(Settings.liveRead(ctx).toFloat()) }

    LaunchedEffect(running, text) {
        withContext(Dispatchers.IO) { totals = db.totals(); vectors = db.vectorCounts(); sourceCount = db.sources().size }
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
                Text(
                    if (!hasEmbedder) "Anlam modeli indirilmedi; Model sekmesinden indirin, paragraflar ondan sonra aranabilir."
                    else "Anlam dizininde ${vectors.first} paragraf" + if (vectors.second > 0) ", ${vectors.second} paragraf sırada." else "; hepsi aranabilir.",
                    style = MaterialTheme.typography.bodySmall,
                )
                if (running) LinearProgressIndicator(Modifier.fillMaxWidth().padding(vertical = 8.dp))
                if (text.isNotEmpty()) Text(text, style = MaterialTheme.typography.bodySmall)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { CollectWorker.start(ctx) }, enabled = !running && sourceCount > 0) { Text("Şimdi topla") }
            OutlinedButton(onClick = { CollectWorker.stop(ctx) }, enabled = running) { Text("Durdur") }
        }
        if (hasEmbedder && vectors.second > 0) {
            OutlinedButton(onClick = { CollectWorker.index(ctx) }, enabled = !running) { Text("Anlam dizinini tamamla (${vectors.second} paragraf)") }
        }
        Text("Her toplamada kaynak başına en çok ${perSource.toInt()} belge okunur. Sıradakiler bir sonraki toplamada gelir.")
        Slider(perSource, { perSource = it }, valueRange = 10f..300f, steps = 28,
            onValueChangeFinished = { Settings.setPerSource(ctx, perSource.toInt()) })
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Her gün kendiliğinden topla (Wi-Fi'da, şarj yeterliyken)", Modifier.weight(1f))
            Switch(daily, { daily = it; Settings.setDaily(ctx, it); CollectWorker.setDaily(ctx, it) })
        }
        Text(
            "Webde arat: arama başlarken seçili kaynakların güncel belge listeleri alınır, başlığı yargıya anlamca en yakın " +
                "${liveRead.toInt()} belge açılıp okunur; toplanmamış belgeler de aramaya katılır. Her kaynağın listesi en çok " +
                "6 saatte bir yenilenir.",
            style = MaterialTheme.typography.bodySmall,
        )
        Slider(liveRead, { liveRead = it }, valueRange = 0f..40f, steps = 39,
            onValueChangeFinished = { Settings.setLiveRead(ctx, liveRead.toInt()) })
        Text("Bir aramada model, yargıya anlamca en yakın ${candidates.toInt()} paragrafı okur. Daha çok paragraf daha uzun sürer.")
        Slider(candidates, { candidates = it }, valueRange = 10f..100f, steps = 17,
            onValueChangeFinished = { Settings.setCandidates(ctx, candidates.toInt()) })
    }
}

@Composable
fun ModelScreen() {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val working by SearchState.working.collectAsState()
    val metadata = remember { NliFiles.manifest(ctx) }
    var haveModel by remember { mutableStateOf(NliFiles.ready(ctx)) }
    var nliDownload by remember { mutableStateOf(NliFiles.downloadId(ctx)) }
    var nliProgress by remember { mutableFloatStateOf(0f) }
    var nliMessage by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var key by remember { mutableStateOf("") }
    var savedKey by remember { mutableStateOf(NliFiles.hasToken(ctx)) }
    var downloads by remember { mutableStateOf(Models.pending(ctx)) }
    var progress by remember { mutableStateOf(mapOf<String, Float>()) }
    var haveEmb by remember { mutableStateOf(Models.embedders.filter { Models.ready(ctx, it) }.map { it.id }.toSet()) }
    var chosenEmb by remember { mutableStateOf(Models.embedder(ctx).id) }
    val recEmb = remember { Models.recommendedEmbedder(ctx) }

    LaunchedEffect(downloads) {
        while (downloads.isNotEmpty()) {
            val still = HashMap<String, Long>()
            val next = HashMap<String, Float>()
            for ((id, download) in downloads) {
                val state = Models.status(ctx, download)
                when (state?.third) {
                    DownloadManager.STATUS_SUCCESSFUL -> {
                        haveEmb = haveEmb + id
                        if (id == chosenEmb) CollectWorker.index(ctx)
                    }
                    DownloadManager.STATUS_FAILED, null -> Toast.makeText(ctx, "Anlam modeli indirilemedi; yeniden deneyin.", Toast.LENGTH_LONG).show()
                    else -> { still[id] = download; next[id] = if (state != null && state.second > 0) state.first.toFloat() / state.second else 0f }
                }
            }
            progress = next
            if (still.size != downloads.size) { downloads = still; break }
            delay(1000)
        }
    }

    LaunchedEffect(nliDownload) {
        val id = nliDownload ?: return@LaunchedEffect
        while (true) {
            val state = Models.status(ctx, id)
            when (state?.third) {
                DownloadManager.STATUS_SUCCESSFUL -> {
                    busy = true; nliMessage = "Model dosyası doğrulanıp kuruluyor…"
                    try {
                        withContext(Dispatchers.IO) { NliFiles.finishDownload(ctx) }
                        haveModel = NliFiles.ready(ctx); nliMessage = "Son eğitilmiş model kullanıma hazır."
                    } catch (e: Exception) { nliMessage = e.message ?: "Model kurulamadı."; NliFiles.cancelDownload(ctx) }
                    busy = false; nliDownload = null; break
                }
                DownloadManager.STATUS_FAILED, null -> {
                    nliMessage = "İndirme tamamlanamadı. Bağlantıyı ve Hugging Face okuma iznini kontrol edin; dosyadan yüklemeyi de kullanabilirsiniz."
                    NliFiles.cancelDownload(ctx); nliDownload = null; break
                }
                else -> {
                    nliProgress = if (state != null && state.second > 0) state.first.toFloat() / state.second else 0f
                    nliMessage = "Model indiriliyor: %${(nliProgress * 100).toInt()}"
                }
            }
            delay(1000)
        }
    }

    val pick = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) scope.launch {
            busy = true; nliMessage = "Model paketi doğrulanıp kuruluyor…"
            try {
                withContext(Dispatchers.IO) {
                    val temp = File(ctx.cacheDir, "import-trained-nli.zip")
                    try {
                        val maximum = metadata.getLong("bytes")
                        ctx.contentResolver.openInputStream(uri)?.use { input ->
                            temp.outputStream().buffered().use { output ->
                                val buffer = ByteArray(1 shl 20); var total = 0L
                                while (true) { val n = input.read(buffer); if (n < 0) break; total += n; require(total <= maximum) { "Bu dosya beklenen model paketi değil." }; output.write(buffer, 0, n) }
                            }
                        } ?: error("Dosya okunamadı.")
                        NliFiles.install(ctx, temp)
                    } finally { temp.delete() }
                }
                haveModel = NliFiles.ready(ctx); nliMessage = "Son eğitilmiş model kullanıma hazır."
            } catch (e: Exception) { nliMessage = e.message ?: "Dosya yüklenemedi." }
            busy = false
        }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Araştırma modelleri", style = MaterialTheme.typography.headlineSmall)
        Text("Modeller bir kez indirildikten sonra telefonun içinde çalışır. Paragraflar bir yapay zekâ hizmetine gönderilmez.", style = MaterialTheme.typography.bodySmall)
        Text("1. Paragrafları bul", style = MaterialTheme.typography.titleMedium)
        for (emb in Models.embedders) {
            val have = emb.id in haveEmb
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        RadioButton(selected = chosenEmb == emb.id, enabled = !working, onClick = {
                            if (chosenEmb != emb.id) { chosenEmb = emb.id; Settings.setEmbedderId(ctx, emb.id); if (have) CollectWorker.index(ctx) }
                        })
                        Column(Modifier.weight(1f)) {
                            Text(emb.title + if (emb == recEmb) " · önerilen" else "", style = MaterialTheme.typography.titleMedium)
                            Text("${emb.note} Yaklaşık ${emb.sizeMb} MB.", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                    progress[emb.id]?.let { LinearProgressIndicator(progress = { it }, modifier = Modifier.fillMaxWidth()) }
                    Row {
                        if (!have && emb.id !in downloads) TextButton(onClick = { downloads = downloads + (emb.id to Models.download(ctx, emb)) }) { Text("İndir") }
                        if (have) TextButton(enabled = !working, onClick = { Models.file(ctx, emb).delete(); haveEmb = haveEmb - emb.id }) { Text("Sil") }
                    }
                }
            }
        }
        Text("2. Paragrafları değerlendir", style = MaterialTheme.typography.titleMedium)
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(metadata.getString("title"), style = MaterialTheme.typography.titleMedium)
                Text("1.000 soruluk eğitimden çıkan paragraf okuyucu. Türkçe veya İngilizce iddiayı paragrafla karşılaştırıp destekliyor, çürütüyor veya ilgisiz diye sınıflandırır.", style = MaterialTheme.typography.bodySmall)
                Text("İndirme: yaklaşık ${metadata.getLong("bytes") / (1024 * 1024)} MB. Kurulum için en az 3 GB boş alan ayırın.", style = MaterialTheme.typography.bodySmall)
                if (haveModel) {
                    Text("Son eğitilmiş model kurulu ve seçili.")
                    TextButton(enabled = !working && !busy, onClick = { scope.launch { Nli.release(); withContext(Dispatchers.IO) { NliFiles.remove(ctx) }; haveModel = false } }) { Text("Modeli sil") }
                } else {
                    Text("Model özel depoda tutuluyor. Okuma anahtarıyla indirin veya tarayıcıdan indirip dosyadan yükleyin.", style = MaterialTheme.typography.bodySmall)
                    androidx.compose.material3.OutlinedTextField(value = key, onValueChange = { key = it }, label = { Text("Hugging Face okuma anahtarı") }, singleLine = true,
                        visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
                    if (savedKey) Text("Okuma anahtarı telefonda şifreli olarak kayıtlı.", style = MaterialTheme.typography.bodySmall)
                    Button(enabled = !busy && nliDownload == null, onClick = {
                        scope.launch {
                            try {
                                if (key.isNotBlank()) { withContext(Dispatchers.IO) { NliFiles.saveToken(ctx, key) }; key = ""; savedKey = true }
                                nliDownload = NliFiles.download(ctx)
                            } catch (e: Exception) { nliMessage = e.message ?: "İndirme başlatılamadı." }
                        }
                    }) { Text("Son modeli indir") }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TextButton(onClick = {
                            val url = metadata.getString("url").replace("/resolve/", "/blob/")
                            ctx.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url)))
                        }) { Text("Tarayıcıdan indir") }
                        TextButton(enabled = !working && !busy && nliDownload == null, onClick = { pick.launch(arrayOf("application/zip", "application/octet-stream")) }) { Text("Dosyadan yükle") }
                    }
                }
                if (nliDownload != null) {
                    LinearProgressIndicator(progress = { nliProgress }, modifier = Modifier.fillMaxWidth())
                    TextButton(onClick = { NliFiles.cancelDownload(ctx); nliDownload = null; nliMessage = "İndirme durduruldu." }) { Text("İndirmeyi durdur") }
                }
                if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                if (nliMessage.isNotEmpty()) Text(nliMessage, style = MaterialTheme.typography.bodySmall)
                if (savedKey) TextButton(onClick = { NliFiles.forgetToken(ctx); savedKey = false }) { Text("Kayıtlı anahtarı sil") }
            }
        }
    }
}
