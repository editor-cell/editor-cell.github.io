package com.orbis.research

import android.app.DownloadManager
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.material3.CardDefaults
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

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        ScreenIntro("03 / KÜTÜPHANE", "Bilgiyi bir araya getir.", "$sourceCount kaynaktan belgeleri topla, kişisel araştırma arşivini oluştur.")
        Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                SectionLabel("KİŞİSEL ARŞİVİN")
                LibraryStats(totals.first, totals.second)
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
        PaperCard {
        SectionLabel("TOPLAMA VE ARAMA AYARLARI")
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
        Slider(liveRead, { liveRead = it }, valueRange = 0f..24f, steps = 23,
            onValueChangeFinished = { Settings.setLiveRead(ctx, liveRead.toInt()) })
        Text("Bir aramada model, yargıya anlamca en yakın ${candidates.toInt()} paragrafı okur. Daha çok paragraf daha uzun sürer.")
        Slider(candidates, { candidates = it }, valueRange = 10f..60f, steps = 9,
            onValueChangeFinished = { Settings.setCandidates(ctx, candidates.toInt()) })
        }
    }
}

@Composable
fun ModelScreen() {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val working by SearchState.working.collectAsState()
    var cloudMessage by remember { mutableStateOf("") }
    var cloudChecking by remember { mutableStateOf(false) }
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

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        ScreenIntro("04 / MODELLER", "Araştırmanın motoru.", "Paragrafları DeepSeek sunucuda okur. Telefona DeepSeek indirmen gerekmez.")
        SectionLabel("01 / PARAGRAFLARI BUL")
        for (emb in Models.embedders) {
            val have = emb.id in haveEmb
            Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
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
        SectionLabel("02 / PARAGRAFLARI DEĞERLENDİR")
        Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("DeepSeek R1 · 32B · Cloudflare", style = MaterialTheme.typography.titleMedium)
                Text("Seçili paragraf okuyucu. Sorgu ve aday paragraflar internet üzerinden Cloudflare'e gönderilir; model telefona indirilmez.", style = MaterialTheme.typography.bodySmall)
                Text("Paragraf bulma için yukarıdaki anlam modeli telefonunda çalışmaya devam eder. DeepSeek bağlantı hatası verirse arama durur; başka modele geçilmez.", style = MaterialTheme.typography.bodySmall)
                Button(enabled = !working && !cloudChecking, onClick = {
                    cloudChecking = true; cloudMessage = "DeepSeek deneniyor…"
                    scope.launch {
                        cloudMessage = try {
                            val answer = CloudReader.judge("The survey found a higher prevalence of obesity in Country A than in Country B.", "Obezitenin daha sık görüldüğü ülkeler")
                            check(answer.startsWith("SUPPORTS")) { "Model deneme paragrafını seçmedi." }
                            "Bağlantı başarılı. DeepSeek deneme paragrafını okudu."
                        } catch (e: Exception) { e.message ?: "DeepSeek'e bağlanılamadı." }
                        cloudChecking = false
                    }
                }) { Text(if (cloudChecking) "Deneniyor…" else "DeepSeek'i dene") }
                if (cloudMessage.isNotEmpty()) Text(cloudMessage, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}
