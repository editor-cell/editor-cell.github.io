package com.orbis.research

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material3.AlertDialog
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DateRangePicker
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.rememberDateRangePickerState
import androidx.compose.ui.Alignment
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.text.font.FontStyle
import androidx.work.ExistingWorkPolicy
import androidx.work.WorkManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.withContext
import kotlinx.coroutines.launch
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.rememberCoroutineScope

/**
 * What the owner is typing and choosing, and live word from the background search. The search
 * itself, its paragraphs and answers, lives in the database (see [SearchWorker]).
 */
object SearchState {
    var claim by mutableStateOf("")
    var range by mutableStateOf(DateRange())
    // Where to search: the sources under the chosen headings plus the sources picked one by one.
    // Nothing chosen means every source.
    var pickedGroups by mutableStateOf(emptySet<Long>())
    var pickedSources by mutableStateOf(emptySet<Long>())

    val status = MutableStateFlow("")
    val working = MutableStateFlow(false)
    /** Goes up whenever the saved search changes, so the screen reads it again. */
    val version = MutableStateFlow(0)

    fun say(text: String) { status.value = text }
    fun changed() { version.update { it + 1 } }

    /** [web]: also visit the listed sources' sites now for documents not yet on the phone. */
    fun start(ctx: Context, web: Boolean) {
        val c = claim.trim()
        if (c.isEmpty()) return
        Settings.setLive(ctx, web)
        val db = Db.get(ctx)
        db.newRun(c, range, sourceIds(db))
        SearchWorker.enqueue(ctx, ExistingWorkPolicy.REPLACE)
        changed()
    }

    /** Stops at once: the model's current answer is cut off, and nothing more is read. */
    fun stop(ctx: Context) {
        Db.get(ctx).setRun(state = Db.RUN_STOPPED, message = "Durduruldu.")
        WorkManager.getInstance(ctx).cancelUniqueWork(SearchWorker.NAME)
        Nli.abortNow()
        say("")
        changed()
    }

    /** Goes on with a stopped or interrupted search from the first paragraph not yet read. */
    fun resume(ctx: Context) {
        Db.get(ctx).setRun(state = Db.RUN_GOING)
        SearchWorker.enqueue(ctx, ExistingWorkPolicy.KEEP)
        changed()
    }

    fun searchesAll() = pickedGroups.isEmpty() && pickedSources.isEmpty()

    /** The source ids to search, or null for all of them. */
    fun sourceIds(db: Db): Set<Long>? = if (searchesAll()) null else db.sourcesIn(pickedGroups) + pickedSources
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SearchScreen(goTo: (Int) -> Unit) {
    val ctx = LocalContext.current
    val db = remember { Db.get(ctx) }
    val totals = remember { db.totals() }
    val vectors = remember { db.vectorCounts() }
    val hasEmbedder = remember { Models.embedderPath(ctx) != null }
    val hasReader = remember { NliFiles.ready(ctx) }
    val s = SearchState
    val version by s.version.collectAsState()
    val status by s.status.collectAsState()
    var run by remember { mutableStateOf<SearchRun?>(null) }
    var findings by remember { mutableStateOf(emptyList<Finding>()) }
    var uncertain by remember { mutableIntStateOf(0) }
    var making by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(version) {
        val (r, f, compatible) = withContext(Dispatchers.IO) {
            val compatible = ctx.getSharedPreferences("search-model", Context.MODE_PRIVATE).getString("current", null) == NliFiles.manifest(ctx).getString("sha256") + EvidenceDecision.VERSION
            Triple(db.run(), if (compatible) Search(ctx).findings() else emptyList(), compatible)
        }
        uncertain = if (compatible) withContext(Dispatchers.IO) { db.answers().count { it.second?.startsWith("UNCERTAIN") == true } } else 0
        run = r?.takeIf { compatible || it.state == Db.RUN_GOING }; findings = f
        if (s.claim.isEmpty() && r != null) s.claim = r.claim
        // A search the phone interrupted (the app was closed) goes on by itself.
        if (r?.state == Db.RUN_GOING && !s.working.value) SearchWorker.enqueue(ctx.applicationContext, ExistingWorkPolicy.KEEP)
    }
    val going = run?.state == Db.RUN_GOING

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(horizontal = 20.dp, vertical = 18.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item {
            ScreenIntro("01 / ARAŞTIR", "Bir yargının izini sür.", "İlgili paragrafları bul, kaynaklarıyla birlikte evraka dönüştür.")
        }
        item { LibraryStats(totals.first, totals.second) }
        item {
          PaperCard {
            SectionLabel("ARAŞTIRMA YARGISI")
            OutlinedTextField(
                s.claim, { s.claim = it }, modifier = Modifier.fillMaxWidth(), minLines = 3, shape = MaterialTheme.shapes.medium,
                placeholder = { Text("ör. Şeker vergisi koyan ülkelerde gazlı içecek tüketimi düştü.") },
            )
            var filtersOpen by rememberSaveable { mutableStateOf(false) }
            TextButton(onClick = { filtersOpen = !filtersOpen }, contentPadding = PaddingValues(0.dp)) {
                Text((if (filtersOpen) "Filtreleri gizle" else "Kaynak ve tarih seç") + " · " + whereLabel(db))
            }
            if (filtersOpen) {
                WhereRow(db, enabled = !going)
                DateRangeRow(db, s.range, s.sourceIds(db), enabled = !going) { s.range = it }
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                if (going) OutlinedButton(onClick = { s.stop(ctx.applicationContext) }) { Text("Durdur") }
                else {
                    val can = s.claim.isNotBlank() && hasEmbedder && hasReader
                    OutlinedButton(onClick = { s.start(ctx.applicationContext, web = false) }, enabled = can, shape = MaterialTheme.shapes.small) { Text("Telefonda arat") }
                    Button(onClick = { s.start(ctx.applicationContext, web = true) }, enabled = can, shape = MaterialTheme.shapes.small) { Text("Webde arat") }
                }
                if (run?.state == Db.RUN_STOPPED && (run?.done ?: 0) < (run?.total ?: 0) && run?.claim == s.claim.trim()) {
                    OutlinedButton(onClick = { s.resume(ctx.applicationContext) }) { Text("Kaldığı yerden devam et") }
                }
                if (findings.isNotEmpty()) OutlinedButton(onClick = { copyAll(ctx, run?.claim ?: s.claim, findings) }) { Text("Tümünü kopyala") }
                val evidence = findings.filter { it.judgement.analogy == null }
                if (evidence.isNotEmpty()) OutlinedButton(enabled = !making, onClick = {
                    making = true
                    scope.launch {
                        val claim = run?.claim ?: s.claim.trim()
                        val result = withContext(Dispatchers.IO) {
                            try {
                                val order = HashMap<String, List<Long>>()
                                fun placed(v: Verdict) = evidence.filter { it.judgement.verdict == v }.map { f ->
                                    val ids = order.getOrPut(f.paragraph.docUrl) { db.paragraphsOfDoc(f.paragraph.docUrl).map { it.first } }
                                    f.paragraph to ids.indexOf(f.paragraph.id)
                                }
                                val file = EvrakPdf.write(ctx, claim, listOf(
                                    "Destekleyenler" to Evrak.group(placed(Verdict.SUPPORTS)),
                                    "Karşı çıkanlar" to Evrak.group(placed(Verdict.CONTRADICTS)),
                                ))
                                file to EvrakPdf.saveToDownloads(ctx, file)
                            } catch (e: Exception) { null }
                        }
                        making = false
                        if (result == null) Toast.makeText(ctx, "Evrak hazırlanamadı.", Toast.LENGTH_SHORT).show()
                        else {
                            if (result.second) Toast.makeText(ctx, "Evrak İndirilenler klasörüne kaydedildi.", Toast.LENGTH_SHORT).show()
                            EvrakPdf.share(ctx, result.first)
                        }
                    }
                }) { Text(if (making) "Evrak hazırlanıyor…" else "Evrak oluştur") }
            }
            Text("Telefonda arat: kayıtlı belgelerinde. Webde arat: seçili kaynaklardan yeni belgeler de alır.", style = MaterialTheme.typography.bodySmall)
          }
        }
        if (!hasReader) item { Notice("Önce son eğitilmiş paragraf modelini yükleyin.", "Model sekmesine git") { goTo(3) } }
        if (!hasEmbedder) item { Notice(Search.NO_EMBEDDER, "Model sekmesine git") { goTo(3) } }
        else if (totals.first == 0) item { Notice("Telefonda henüz belge yok. Önce kaynak ekleyip belge toplayın.", "Kaynaklara git") { goTo(1) } }
        else if (vectors.second > 0) item {
            Notice("${vectors.second} paragraf henüz anlam dizininde değil; aramada çıkmazlar. Topla sekmesinden dizini tamamlayın.", "Topla sekmesine git") { goTo(2) }
        }
        val r = run
        if (r != null && r.state == Db.RUN_GOING) item {
            Column {
                LinearProgressIndicator(Modifier.fillMaxWidth())
                Text(status.ifEmpty { "Sırada; birazdan başlıyor…" }, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 4.dp))
                Text("Uygulamadan çıkabilirsiniz; arama bildirimle sürer.", style = MaterialTheme.typography.bodySmall)
            }
        }
        if (r != null && (r.state == Db.RUN_FAILED || r.state == Db.RUN_STOPPED) && r.message != null) item {
            Text(r.message + if (r.state == Db.RUN_STOPPED) " ${r.done}/${r.total} paragraf okunmuştu." else "", style = MaterialTheme.typography.bodyMedium)
        }
        if (r != null && r.state == Db.RUN_DONE && findings.isEmpty()) item {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                Column(Modifier.padding(16.dp)) {
                    Text("Bulamadım.", style = MaterialTheme.typography.titleLarge)
                    Text(
                        if (r.total == 0 && !r.concepts.isNullOrBlank()) "Yargının kavramlarını (${Concepts.names(Concepts.parse(r.concepts))}) " +
                            "birlikte anlatan paragraf, seçilen kaynaklarda ve tarihlerde bulunan belgelerde yok."
                        else if (r.total == 0) "Seçilen kaynaklarda ve tarihlerde anlam dizininde paragraf yok."
                        else "Yargıya anlamca en yakın ${r.total} paragraf okundu; evraka alınabilecek yeterince belirgin bir sonuç bulunamadı. Bu, kaynaklarda kanıt olmadığı anlamına gelmez.",
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        }
        if (r != null && r.state == Db.RUN_DONE && findings.isNotEmpty()) item {
            Text("${r.total} paragraf okundu, ${findings.size} tanesi model tarafından destekleyen veya karşı çıkan aday olarak seçildi.", style = MaterialTheme.typography.bodySmall)
        }
        if (r != null && r.state == Db.RUN_DONE && !r.concepts.isNullOrBlank()) item {
            Text("Aranan kavramlar: ${Concepts.names(Concepts.parse(r.concepts))}", style = MaterialTheme.typography.bodySmall)
        }
        if (uncertain > 0) item {
            Text("$uncertain paragrafta karar belirsiz kaldı; bunlar destekleyen veya karşı çıkan olarak evraka alınmadı.", style = MaterialTheme.typography.bodySmall)
        }
        items(findings, key = { it.paragraph.id }) { f -> FindingCard(f) }
        if (r?.suggestion != null) item { SuggestionCard(r.suggestion) }
        item { Text("", Modifier.padding(bottom = 24.dp)) }
    }
}

@Composable
private fun Notice(text: String, action: String, onAction: () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
        Column(Modifier.padding(16.dp)) {
            Text(text, style = MaterialTheme.typography.bodyMedium)
            TextButton(onClick = onAction) { Text(action) }
        }
    }
}

/** A direction for the research, written by the model: shown apart, and never as a finding. */
@Composable
private fun SuggestionCard(text: String) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer)) {
        Column(Modifier.padding(14.dp)) {
            Text("ÖNERİ (motorun önerisi; belge bilgisi değil)", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelLarge)
            Text(text, fontStyle = FontStyle.Italic, modifier = Modifier.padding(top = 6.dp))
        }
    }
}

@Composable
private fun FindingCard(f: Finding) {
    val ctx = LocalContext.current
    val p = f.paragraph
    val j = f.judgement
    val supports = j.verdict == Verdict.SUPPORTS
    val an = j.analogy
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        shape = MaterialTheme.shapes.large,
    ) {
        Column(Modifier.padding(18.dp)) {
            androidx.compose.material3.Surface(
                color = if (an != null) MaterialTheme.colorScheme.tertiaryContainer else if (supports) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.errorContainer,
                shape = MaterialTheme.shapes.extraSmall,
            ) {
                Text(label(j), Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                    color = if (an != null) MaterialTheme.colorScheme.onTertiaryContainer else if (supports) MaterialTheme.colorScheme.onSecondaryContainer else MaterialTheme.colorScheme.onErrorContainer,
                    style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
            }
            if (an != null) {
                // The model's kıyas comes first and is marked as its own reasoning; the paragraph it
                // rests on follows, word for word.
                Text("Motorun kıyası (belgede yok):", style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(top = 6.dp))
                for ((name, text) in listOf("Asıl" to an.asil, "Fer" to an.fer, "İllet" to an.illet, "Hüküm" to an.hukum)) {
                    Text("$name: $text", fontStyle = FontStyle.Italic, style = MaterialTheme.typography.bodyMedium)
                }
                Text("Dayandığı paragraf:", style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(top = 8.dp))
            }
            SelectionContainer { Text("“${p.text}”", style = MaterialTheme.typography.bodyLarge.copy(fontFamily = androidx.compose.ui.text.font.FontFamily.Serif, fontSize = 17.sp, lineHeight = 28.sp), modifier = Modifier.padding(vertical = 8.dp)) }
            if (j.indirect && an == null) {
                // The model's own words, set apart from the quote and never mistaken for it.
                Text(
                    if (j.reason != null) "Gerekçe (motorun): ${j.reason}"
                    else if (j.reasonDropped) "Motorun gerekçesi, paragrafta olmayan bir rakam içerdiği için gösterilmiyor; paragrafı dikkatle okuyun."
                    else "Motor bir gerekçe yazmadı; paragrafı dikkatle okuyun.",
                    fontStyle = FontStyle.Italic, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(bottom = 6.dp),
                )
            }
            Text(p.docTitle, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.bodyMedium)
            Text(listOf(p.sourceName, p.docDate).filter { it.isNotEmpty() }.joinToString(" · "), style = MaterialTheme.typography.bodySmall)
            SelectionContainer {
                Text(p.docUrl, color = MaterialTheme.colorScheme.primary, textDecoration = TextDecoration.Underline, style = MaterialTheme.typography.bodySmall)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = { open(ctx, p) }) { Text("Belgeyi aç") }
                TextButton(onClick = { copy(ctx, quote(p)) }) { Text("Kopyala") }
            }
        }
    }
}

private fun quote(p: Paragraph) = "“${p.text}”\n— ${p.docTitle}${if (p.docDate.isNotEmpty()) " (${p.docDate})" else ""}\n${p.docUrl}"

private fun label(j: Judgement) = when {
    j.analogy != null -> "KIYAS · " + if (j.verdict == Verdict.SUPPORTS) "DESTEKLİYOR OLABİLİR" else "ÇÜRÜTÜYOR OLABİLİR"
    else -> (if (j.verdict == Verdict.SUPPORTS) "DESTEKLİYOR" else "ÇÜRÜTÜYOR") + if (j.indirect) " · DOLAYLI" else ""
}

private fun copyAll(ctx: Context, claim: String, list: List<Finding>) {
    val text = buildString {
        appendLine("Yargı: $claim").appendLine()
        for (f in list) {
            appendLine("[${label(f.judgement)}]")
            f.judgement.analogy?.let { a ->
                appendLine("Motorun kıyası (belgede yok): Asıl: ${a.asil} / Fer: ${a.fer} / İllet: ${a.illet} / Hüküm: ${a.hukum}")
            }
            appendLine(quote(f.paragraph))
            f.judgement.reason?.let { appendLine("Gerekçe (motorun): $it") }
            appendLine()
        }
    }
    copy(ctx, text)
}

private fun copy(ctx: Context, text: String) {
    ctx.getSystemService(ClipboardManager::class.java).setPrimaryClip(ClipData.newPlainText("Orbis", text))
    Toast.makeText(ctx, "Kopyalandı.", Toast.LENGTH_SHORT).show()
}

/** Opens the document itself; on a web page the browser is asked to scroll to the paragraph. */
private fun open(ctx: Context, p: Paragraph) {
    val isPdf = Extract.looksPdf(p.docUrl)
    val words = p.text.split(' ').take(8).joinToString(" ")
    val target = if (isPdf || p.docUrl.contains('#')) p.docUrl else p.docUrl + "#:~:text=" + Uri.encode(words)
    try { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(target)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    catch (e: Exception) { Toast.makeText(ctx, "Açacak bir tarayıcı bulunamadı.", Toast.LENGTH_SHORT).show() }
}

/** Which documents a search looks at, by date: quick choices, any range from a calendar, and undated ones. */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun DateRangeRow(db: Db, range: DateRange, sourceIds: Set<Long>?, enabled: Boolean, onChange: (DateRange) -> Unit) {
    var picking by remember { mutableStateOf(false) }
    val counts = remember(range, sourceIds) { db.docsIn(range, sourceIds) }
    Column(Modifier.padding(top = 8.dp)) {
        Text("Tarih aralığı: ${range.label()}", style = MaterialTheme.typography.titleSmall)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            val und = range.includeUndated
            FilterChip(range.isAll, enabled = enabled, onClick = { onChange(DateRange(includeUndated = und)) }, label = { Text("Tümü") })
            for (n in listOf(1, 5, 10)) {
                val r = DateRange.lastYears(n, includeUndated = und)
                FilterChip(range.from == r.from && range.to == r.to, enabled = enabled, onClick = { onChange(r) }, label = { Text("Son $n yıl") })
            }
            FilterChip(!range.isAll && listOf(1, 5, 10).none { DateRange.lastYears(it).from == range.from && DateRange.lastYears(it).to == range.to },
                enabled = enabled, onClick = { picking = true }, label = { Text("Tarih seç…") })
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(range.includeUndated, enabled = enabled, onCheckedChange = { onChange(range.copy(includeUndated = it)) })
            Text("Tarihi belli olmayan belgeler de aransın", style = MaterialTheme.typography.bodySmall)
        }
        Text(
            "Seçilen kaynaklarda bu aralıkta telefonda ${counts.first} belge var" + if (counts.second > 0) " (${counts.second} tanesinin tarihi belli değil)." else ".",
            style = MaterialTheme.typography.bodySmall,
        )
    }
    if (picking) {
        val state = rememberDateRangePickerState(
            initialSelectedStartDateMillis = range.from?.let { toMillis(it) },
            initialSelectedEndDateMillis = range.to?.let { toMillis(it) },
        )
        DatePickerDialog(
            onDismissRequest = { picking = false },
            confirmButton = {
                TextButton(enabled = state.selectedStartDateMillis != null, onClick = {
                    picking = false
                    onChange(DateRange(state.selectedStartDateMillis?.let(::toDate), state.selectedEndDateMillis?.let(::toDate) ?: state.selectedStartDateMillis?.let(::toDate), range.includeUndated))
                }) { Text("Tamam") }
            },
            dismissButton = { TextButton(onClick = { picking = false }) { Text("Vazgeç") } },
        ) {
            DateRangePicker(state, modifier = Modifier.weight(1f), title = { Text("Başlangıç ve bitiş gününe dokunun", Modifier.padding(16.dp)) })
        }
    }
}

private fun toMillis(d: String) = java.time.LocalDate.parse(d).atStartOfDay(java.time.ZoneOffset.UTC).toInstant().toEpochMilli()
private fun toDate(ms: Long) = java.time.Instant.ofEpochMilli(ms).atZone(java.time.ZoneOffset.UTC).toLocalDate().toString()

private fun whereLabel(db: Db): String {
    val s = SearchState
    if (s.searchesAll()) return "Tüm kaynaklar"
    val names = db.groups().filter { it.id in s.pickedGroups }.map { it.name }
    return (names + if (s.pickedSources.isEmpty()) emptyList() else listOf("${s.pickedSources.size} seçili kaynak")).joinToString(" + ")
}

/** Where a search looks: every source, the sources under some headings, or sources picked one by one. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun WhereRow(db: Db, enabled: Boolean) {
    val s = SearchState
    val groups = remember { db.groups() }
    val sources = remember { db.sources() }
    var picking by remember { mutableStateOf(false) }
    // Headings or sources removed since they were chosen no longer count.
    LaunchedEffect(groups, sources) {
        s.pickedGroups = s.pickedGroups.intersect(groups.map { it.id }.toSet())
        s.pickedSources = s.pickedSources.intersect(sources.map { it.id }.toSet())
    }
    val count = remember(s.pickedGroups, s.pickedSources) { s.sourceIds(db)?.size }
    Column(Modifier.padding(top = 8.dp)) {
        Text("Nerede aransın: ${whereLabel(db)}", style = MaterialTheme.typography.titleSmall)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            FilterChip(s.searchesAll(), enabled = enabled, onClick = { s.pickedGroups = emptySet(); s.pickedSources = emptySet() },
                label = { Text("Tüm kaynaklar") })
            for (g in groups) {
                val on = g.id in s.pickedGroups
                FilterChip(on, enabled = enabled, onClick = { s.pickedGroups = if (on) s.pickedGroups - g.id else s.pickedGroups + g.id },
                    label = { Text("${g.name} (${g.sourceCount})") })
            }
            FilterChip(s.pickedSources.isNotEmpty(), enabled = enabled, onClick = { picking = true },
                label = { Text(if (s.pickedSources.isEmpty()) "Kaynak seç…" else "${s.pickedSources.size} kaynak seçili") })
        }
        if (count != null) Text("$count kaynakta aranacak.", style = MaterialTheme.typography.bodySmall)
    }
    if (picking) PickSourcesDialog(sources, s.pickedSources, onDone = { s.pickedSources = it; picking = false }, onDismiss = { picking = false })
}

@Composable
private fun PickSourcesDialog(sources: List<Source>, initial: Set<Long>, onDone: (Set<Long>) -> Unit, onDismiss: () -> Unit) {
    var chosen by remember { mutableStateOf(initial) }
    var filter by remember { mutableStateOf("") }
    val shown = sources.filter { f ->
        filter.isBlank() || f.name.contains(filter, true) || f.url.contains(filter, true) || f.groups.any { it.contains(filter, true) }
    }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Hangi kaynaklarda aransın?") },
        text = {
            Column {
                if (sources.size > 8) OutlinedTextField(filter, { filter = it }, label = { Text("Ad ya da başlık ara") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                LazyColumn(Modifier.heightIn(max = 380.dp)) {
                    items(shown, key = { it.id }) { src ->
                        val on = src.id in chosen
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().clickable { chosen = if (on) chosen - src.id else chosen + src.id }) {
                            Checkbox(on, onCheckedChange = { chosen = if (on) chosen - src.id else chosen + src.id })
                            Column {
                                Text(src.name, style = MaterialTheme.typography.bodyMedium)
                                if (src.groups.isNotEmpty()) Text(src.groups.joinToString(" · "), style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = { onDone(chosen) }) { Text(if (chosen.isEmpty()) "Tamam" else "${chosen.size} kaynak seç") } },
        dismissButton = { TextButton(onClick = { chosen = emptySet() }) { Text("Temizle") } },
    )
}
