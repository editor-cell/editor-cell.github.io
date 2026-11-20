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
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
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

    /**
     * One step from claim to evrak (owner, 19 Nov 2026): the earlier documents are cleared, the
     * sources' sites are searched live, and when the search ends the evrak is made and opened.
     */
    fun startEvrak(ctx: Context) {
        val c = claim.trim()
        if (c.isEmpty()) return
        Settings.setLive(ctx, true)
        val db = Db.get(ctx)
        db.clearArchive()
        db.newRun(c, range, sourceIds(db))
        db.run()?.let { autoEvrakFor(ctx, it.startedAt) }
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

    /** The search whose end should make the evrak by itself; 0 for none. */
    fun autoEvrakFor(ctx: Context, startedAt: Long) =
        ctx.getSharedPreferences("evrak", Context.MODE_PRIVATE).edit().putLong("auto", startedAt).apply()

    fun autoEvrak(ctx: Context): Long = ctx.getSharedPreferences("evrak", Context.MODE_PRIVATE).getLong("auto", 0L)

    fun searchesAll() = pickedGroups.isEmpty() && pickedSources.isEmpty()

    /** The source ids to search, or null for all of them. */
    fun sourceIds(db: Db): Set<Long>? = if (searchesAll()) null else db.sourcesIn(pickedGroups) + pickedSources
}

@OptIn(ExperimentalLayoutApi::class)
/**
 * Writes the evrak (supporting and contradicting paragraphs), keeps it in the phone's Evraklar and
 * in Downloads, then opens it ([share] false) or the share sheet ([share] true).
 */
private suspend fun makeEvrak(ctx: Context, db: Db, claim: String, evidence: List<Finding>, share: Boolean = false) {
    val file = withContext(Dispatchers.IO) {
        try {
            val order = HashMap<String, List<Long>>()
            fun placed(v: Verdict) = evidence.filter { it.judgement.verdict == v }.map { f ->
                val ids = order.getOrPut(f.paragraph.docUrl) { db.paragraphsOfDoc(f.paragraph.docUrl).map { it.first } }
                f.paragraph to ids.indexOf(f.paragraph.id)
            }
            val sections = listOf(
                "Destekleyenler" to Evrak.group(placed(Verdict.SUPPORTS)),
                "Karşı çıkanlar" to Evrak.group(placed(Verdict.CONTRADICTS)),
            )
            val file = EvrakPdf.write(ctx, claim, sections)
            try { EvrakLibrary.save(ctx, file, claim, java.time.LocalDate.now().toString(), sections) } catch (e: Exception) {}
            EvrakPdf.saveToDownloads(ctx, file)
            file
        } catch (e: Exception) { null }
    }
    if (file == null) Toast.makeText(ctx, "Evrak hazırlanamadı.", Toast.LENGTH_SHORT).show()
    else if (share) EvrakPdf.share(ctx, file)
    else EvrakLibrary.open(ctx, file)
}

@Composable
fun SearchScreen(goTo: (Int) -> Unit) {
    val ctx = LocalContext.current
    val db = remember { Db.get(ctx) }
    val totals = remember { db.totals() }
    val hasEmbedder = remember { Models.embedderPath(ctx) != null }
    val s = SearchState
    val version by s.version.collectAsState()
    val status by s.status.collectAsState()
    var run by remember { mutableStateOf<SearchRun?>(null) }
    var findings by remember { mutableStateOf(emptyList<Finding>()) }
    var uncertain by remember { mutableIntStateOf(0) }
    var notes by remember { mutableStateOf(emptyList<Pair<String, String>>()) }
    var making by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(version) {
        val (r, f, compatible) = withContext(Dispatchers.IO) {
            val compatible = ctx.getSharedPreferences("search-model", Context.MODE_PRIVATE).getString("current", null) == Nli.MODEL_ID
            Triple(db.run(), if (compatible) Search(ctx).findings() else emptyList(), compatible)
        }
        uncertain = if (compatible) withContext(Dispatchers.IO) { db.answers().count { it.second?.startsWith("UNCERTAIN") == true } } else 0
        run = r?.takeIf { compatible || it.state == Db.RUN_GOING }; findings = f
        // When nothing was found: what Sol said about the closest paragraphs, with their documents.
        notes = if (compatible && f.isEmpty()) withContext(Dispatchers.IO) {
            db.answers().mapNotNull { (id, a) ->
                val reason = a?.substringAfter("\nREASON: ", "")?.trim().orEmpty()
                if (reason.isEmpty()) null else db.paragraph(id)?.let { it.docTitle.ifBlank { it.sourceName } to reason }
            }.take(6)
        } else emptyList()
        if (s.claim.isEmpty() && r != null) s.claim = r.claim
        // The search started with "Evrak oluştur" has ended: the evrak is made and opened at once.
        if (r != null && r.state != Db.RUN_GOING && r.startedAt != 0L && s.autoEvrak(ctx) == r.startedAt) {
            s.autoEvrakFor(ctx, 0L)
            if (r.state == Db.RUN_DONE) {
                val evidence = f.filter { it.judgement.analogy == null }
                if (evidence.isEmpty()) Toast.makeText(ctx, "Destekleyen ya da karşı çıkan paragraf bulunamadı; evrak oluşturulmadı.", Toast.LENGTH_LONG).show()
                else { making = true; makeEvrak(ctx, db, r.claim, evidence); making = false }
            }
        }
        // A search the phone interrupted (the app was closed) goes on by itself.
        if (r?.state == Db.RUN_GOING && !s.working.value) SearchWorker.enqueue(ctx.applicationContext, ExistingWorkPolicy.KEEP)
    }
    val going = run?.state == Db.RUN_GOING

    val evidence = findings.filter { it.judgement.analogy == null }
    var reader by remember { mutableStateOf(Settings.reader(ctx)) }
    var openFilter by rememberSaveable { mutableIntStateOf(0) }
    val r = run

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(horizontal = 24.dp, vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { Text("Ne arıyorsun?", style = MaterialTheme.typography.headlineMedium) }
        item {
            OutlinedTextField(
                s.claim, { s.claim = it }, modifier = Modifier.fillMaxWidth(), minLines = 4, enabled = !going,
                shape = RoundedCornerShape(16.dp), textStyle = MaterialTheme.typography.bodyLarge.copy(fontSize = 16.sp),
                placeholder = { Text("Bir soru ya da yargı yaz") },
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = MaterialTheme.colorScheme.surface, unfocusedContainerColor = MaterialTheme.colorScheme.surface,
                    disabledContainerColor = MaterialTheme.colorScheme.surface,
                    unfocusedBorderColor = MaterialTheme.colorScheme.outlineVariant, disabledBorderColor = MaterialTheme.colorScheme.outlineVariant,
                    disabledTextColor = MaterialTheme.colorScheme.onSurface,
                ),
            )
        }
        item {
            Box(Modifier.fillMaxWidth().border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(16.dp))
                .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(16.dp))) {
                Column {
                    FilterLine(Icons.Filled.DateRange, "Tarih", s.range.label(), open = openFilter == 1, enabled = !going) { openFilter = if (openFilter == 1) 0 else 1 }
                    if (openFilter == 1) Column(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 12.dp)) {
                        DateRangeRow(db, s.range, s.sourceIds(db), enabled = !going) { s.range = it }
                    }
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    FilterLine(Icons.Filled.List, "Kaynaklar", whereLabel(db), open = openFilter == 2, enabled = !going) { openFilter = if (openFilter == 2) 0 else 2 }
                    if (openFilter == 2) Column(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 12.dp)) { WhereRow(db, enabled = !going) }
                }
            }
        }
        item {
            ReaderPicker(reader, enabled = !going) { reader = it; Settings.setReader(ctx, it) }
        }
        item {
            if (going) OutlinedButton(onClick = { s.stop(ctx.applicationContext) }, modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(16.dp)) { Text("Durdur", fontWeight = FontWeight.SemiBold) }
            else Button(
                onClick = { s.startEvrak(ctx.applicationContext) }, enabled = s.claim.isNotBlank() && !making,
                modifier = Modifier.fillMaxWidth().height(56.dp), shape = RoundedCornerShape(16.dp),
            ) {
                Icon(Icons.Filled.Search, contentDescription = null, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(10.dp))
                Text(if (making) "Evrak hazırlanıyor…" else "Ara", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            }
        }
        if (r?.state in setOf(Db.RUN_STOPPED, Db.RUN_FAILED) && (r?.done ?: 0) < (r?.total ?: 0) && r?.claim == s.claim.trim()) item {
            OutlinedButton(onClick = { s.resume(ctx.applicationContext) }, modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(16.dp)) { Text("Kaldığı yerden devam et") }
        }
        if (r != null && r.state == Db.RUN_GOING) item { ProgressCard(r, status, reader) }
        if (r != null && (r.state == Db.RUN_FAILED || r.state == Db.RUN_STOPPED) && r.message != null) item {
            Text(r.message + if (r.state == Db.RUN_STOPPED) " ${r.done}/${r.total}" else "", style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if (r != null && r.state == Db.RUN_DONE && evidence.isEmpty()) item {
            PaperCard {
                Text("Bulamadım.", style = MaterialTheme.typography.titleLarge)
                for ((title, reason) in notes) Text("$title: $reason", style = MaterialTheme.typography.bodySmall)
            }
        }
        if (r != null && r.state == Db.RUN_DONE && evidence.isNotEmpty()) {
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    StatBox("Destekleyen", evidence.count { it.judgement.verdict == Verdict.SUPPORTS }, Modifier.weight(1f), MaterialTheme.colorScheme.onSurface)
                    StatBox("Karşı çıkan", evidence.count { it.judgement.verdict == Verdict.CONTRADICTS }, Modifier.weight(1f), MaterialTheme.colorScheme.primary)
                }
            }
            item { DocsCard(evidence) }
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Button(enabled = !making, onClick = {
                        making = true
                        scope.launch { makeEvrak(ctx, db, r.claim, evidence); making = false }
                    }, modifier = Modifier.weight(1f).height(56.dp), shape = RoundedCornerShape(16.dp)) {
                        Text(if (making) "Hazırlanıyor…" else "Evrakı aç", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                    }
                    OutlinedButton(enabled = !making, onClick = {
                        making = true
                        scope.launch { makeEvrak(ctx, db, r.claim, evidence, share = true); making = false }
                    }, modifier = Modifier.size(56.dp), shape = RoundedCornerShape(16.dp), contentPadding = PaddingValues(0.dp)) {
                        Icon(Icons.Filled.Share, contentDescription = "Paylaş")
                    }
                }
            }
        }
        if (r?.suggestion != null) item { SuggestionCard(r.suggestion) }
        item { Spacer(Modifier.height(24.dp)) }
    }
}

@Composable
private fun FilterLine(icon: ImageVector, label: String, value: String, open: Boolean, enabled: Boolean, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().heightIn(min = 56.dp).clickable(enabled = enabled, onClick = onClick).padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(12.dp))
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 15.sp)
        Spacer(Modifier.width(12.dp))
        Text(value, fontSize = 15.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f), textAlign = androidx.compose.ui.text.style.TextAlign.End)
        Spacer(Modifier.width(6.dp))
        Icon(if (open) Icons.Filled.KeyboardArrowDown else Icons.Filled.KeyboardArrowRight, contentDescription = null,
            tint = MaterialTheme.colorScheme.outline, modifier = Modifier.size(20.dp))
    }
}

/** Sol (Astra when Sol is unsure) or Astra alone, picked per search (owner, 20 Nov 2026). */
@Composable
private fun ReaderPicker(reader: String, enabled: Boolean, onPick: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Okuyucu", fontSize = 13.sp, fontWeight = FontWeight.Medium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Row(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(14.dp)).padding(4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            for ((key, name) in listOf("sol" to "Sol", "astra" to "Astra")) {
                val on = reader == key
                Box(Modifier.weight(1f).height(44.dp)
                    .background(if (on) MaterialTheme.colorScheme.surface else androidx.compose.ui.graphics.Color.Transparent, RoundedCornerShape(11.dp))
                    .clickable(enabled = enabled) { onPick(key) }, contentAlignment = Alignment.Center) {
                    Text(name, fontSize = 15.sp, fontWeight = if (on) FontWeight.SemiBold else FontWeight.Medium,
                        color = if (on) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@Composable
private fun ProgressCard(r: SearchRun, status: String, reader: String) {
    PaperCard {
        val reading = r.total > 0
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(if (reading) (if (reader == "astra") "Astra okuyor" else "Sol okuyor") else "Kaynaklar okunuyor",
                fontSize = 15.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
            if (reading) Text("${r.done} / ${r.total}", fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
        }
        if (reading) LinearProgressIndicator(progress = { if (r.total == 0) 0f else r.done.toFloat() / r.total },
            modifier = Modifier.fillMaxWidth().height(6.dp), trackColor = MaterialTheme.colorScheme.surfaceVariant)
        else LinearProgressIndicator(Modifier.fillMaxWidth().height(6.dp), trackColor = MaterialTheme.colorScheme.surfaceVariant)
        Step("Kaynaklar okundu", done = reading, now = !reading)
        Step("Paragraflar seçildi", done = reading, now = false)
        Step("Paragraflar okunuyor", done = false, now = reading)
        Step("Evrak", done = false, now = false)
        if (status.isNotEmpty()) Text(status, style = MaterialTheme.typography.bodySmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun Step(text: String, done: Boolean, now: Boolean) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        val ink = MaterialTheme.colorScheme.onSurface
        when {
            done -> Box(Modifier.size(24.dp).background(ink, CircleShape), contentAlignment = Alignment.Center) {
                Icon(Icons.Filled.Check, contentDescription = null, tint = MaterialTheme.colorScheme.surface, modifier = Modifier.size(15.dp))
            }
            now -> Box(Modifier.size(24.dp).border(2.dp, MaterialTheme.colorScheme.primary, CircleShape), contentAlignment = Alignment.Center) {
                Box(Modifier.size(8.dp).background(MaterialTheme.colorScheme.primary, CircleShape))
            }
            else -> Box(Modifier.size(24.dp).border(2.dp, MaterialTheme.colorScheme.outlineVariant, CircleShape))
        }
        Spacer(Modifier.width(12.dp))
        Text(text, fontSize = 15.sp, fontWeight = if (now) FontWeight.SemiBold else FontWeight.Normal,
            color = if (done || now) ink else MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun StatBox(label: String, n: Int, modifier: Modifier, color: androidx.compose.ui.graphics.Color) {
    Column(modifier.border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(16.dp))
        .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(16.dp)).padding(horizontal = 16.dp, vertical = 14.dp)) {
        Text("$n", fontSize = 28.sp, fontWeight = FontWeight.SemiBold, color = color)
        Text(label, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

/** The documents the evrak will hold: title, source and date, and how many paragraphs from each. */
@Composable
private fun DocsCard(evidence: List<Finding>) {
    val docs = evidence.groupBy { it.paragraph.docUrl }.values.toList()
    Column(Modifier.fillMaxWidth().border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(16.dp))
        .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(16.dp))) {
        docs.forEachIndexed { i, list ->
            val p = list.first().paragraph
            if (i > 0) HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(p.docTitle.ifBlank { p.docUrl }, fontSize = 15.sp, fontWeight = FontWeight.Medium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Text(p.sourceName + " · " + p.docDate.ifBlank { "tarih yok" }, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Spacer(Modifier.width(12.dp))
                Text("${list.size}", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
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
            j.split?.let { Text(splitText(it), style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(top = 6.dp)) }
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
    else -> (if (j.verdict == Verdict.SUPPORTS) "DESTEKLİYOR" else "ÇÜRÜTÜYOR") + (if (j.indirect) " · DOLAYLI" else "") + (if (j.split != null) " · MODELLER AYRIŞTI" else "")
}

/** "Sol=UNRELATED Astra=SUPPORTS" as "Sol: ilgisiz · Astra: destekliyor". */
private fun splitText(split: String) = split.split(" ").joinToString(" · ") { part ->
    val (model, verdict) = part.split("=", limit = 2).let { it[0] to it.getOrElse(1) { "" } }
    model + ": " + when (verdict) { "SUPPORTS" -> "destekliyor"; "CONTRADICTS" -> "çürütüyor"; else -> "ilgisiz" }
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
