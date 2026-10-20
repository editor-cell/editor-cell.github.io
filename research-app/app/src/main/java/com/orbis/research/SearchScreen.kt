package com.orbis.research

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/** The current search lives here, outside the screen, so it keeps going when the tab changes. */
object SearchState {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    var claim by mutableStateOf("")
    var status by mutableStateOf("")
    var running by mutableStateOf(false)
    var finished by mutableStateOf(false)
    var read by mutableStateOf(0)
    val findings = mutableStateListOf<Finding>()
    private var job: Job? = null

    fun start(ctx: Context) {
        val c = claim.trim()
        if (c.isEmpty() || running) return
        findings.clear(); finished = false; read = 0; running = true
        job = scope.launch {
            try {
                val path = Settings.modelPath(ctx)
                if (path == null || !java.io.File(path).exists()) { status = "Önce Model sekmesinden bir model indirin."; return@launch }
                status = "Model yükleniyor…"
                if (!Llm.ensure(ctx, path)) { status = "Model açılamadı. Dosya bozuk olabilir; Model sekmesinden yeniden indirin."; return@launch }
                read = Search(ctx).run(c, { s -> status = s }) { f ->
                    scope.launch(Dispatchers.Main) { findings.add(f) }
                }
                status = ""
                finished = true
            } catch (e: CancellationException) {
                status = "Durduruldu."
            } catch (e: Throwable) {
                status = "Bir hata oldu: ${e.message}"
            } finally {
                running = false
            }
        }
    }

    fun stop() { job?.cancel() }
}

@Composable
fun SearchScreen(goTo: (Int) -> Unit) {
    val ctx = LocalContext.current
    val db = remember { Db.get(ctx) }
    val totals = remember { db.totals() }
    val s = SearchState

    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Text("Yargıyı yazın", style = MaterialTheme.typography.headlineSmall, modifier = Modifier.padding(top = 16.dp))
            Text(
                "Araç, telefondaki ${totals.first} belgenin paragraflarında yargıyı destekleyen ya da çürüten yeri arar ve " +
                    "paragrafı belgeden aynen getirir. Türkçe yazabilirsiniz.",
                style = MaterialTheme.typography.bodySmall,
            )
        }
        item {
            OutlinedTextField(
                s.claim, { s.claim = it }, modifier = Modifier.fillMaxWidth(), minLines = 3,
                placeholder = { Text("ör. Şeker vergisi koyan ülkelerde gazlı içecek tüketimi düştü.") },
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                if (s.running) OutlinedButton(onClick = { s.stop() }) { Text("Durdur") }
                else Button(onClick = { s.start(ctx.applicationContext) }, enabled = s.claim.isNotBlank()) { Text("Ara") }
                if (s.findings.isNotEmpty()) OutlinedButton(onClick = { copyAll(ctx, s.claim, s.findings) }) { Text("Tümünü kopyala") }
            }
        }
        if (totals.first == 0) item {
            Card {
                Column(Modifier.padding(12.dp)) {
                    Text("Telefonda henüz belge yok. Önce kaynak ekleyip belge toplayın.")
                    TextButton(onClick = { goTo(1) }) { Text("Kaynaklara git") }
                }
            }
        }
        if (s.running || s.status.isNotEmpty()) item {
            Column {
                if (s.running) LinearProgressIndicator(Modifier.fillMaxWidth())
                Text(s.status, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 4.dp))
                if (s.status.startsWith("Önce Model")) TextButton(onClick = { goTo(3) }) { Text("Model sekmesine git") }
            }
        }
        if (s.finished && s.findings.isEmpty()) item {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                Column(Modifier.padding(16.dp)) {
                    Text("Bulamadım.", style = MaterialTheme.typography.titleLarge)
                    Text(
                        "En yakın ${s.read} paragraf okundu; hiçbiri bu yargıyı açıkça desteklemiyor ya da çürütmüyor.",
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        }
        if (s.finished && s.findings.isNotEmpty()) item {
            Text("${s.read} paragraf okundu, ${s.findings.size} tanesi yargıyla ilgili.", style = MaterialTheme.typography.bodySmall)
        }
        items(s.findings.sortedBy { it.verdict.ordinal }, key = { it.paragraph.id }) { f -> FindingCard(f) }
        item { Text("", Modifier.padding(bottom = 24.dp)) }
    }
}

@Composable
private fun FindingCard(f: Finding) {
    val ctx = LocalContext.current
    val p = f.paragraph
    val supports = f.verdict == Verdict.SUPPORTS
    Card(
        colors = CardDefaults.cardColors(
            containerColor = if (supports) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.errorContainer,
        ),
    ) {
        Column(Modifier.padding(14.dp)) {
            Text(if (supports) "DESTEKLİYOR" else "ÇÜRÜTÜYOR", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelLarge)
            SelectionContainer { Text("“${p.text}”", style = MaterialTheme.typography.bodyLarge, modifier = Modifier.padding(vertical = 8.dp)) }
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

private fun copyAll(ctx: Context, claim: String, list: List<Finding>) {
    val text = buildString {
        appendLine("Yargı: $claim").appendLine()
        for (f in list.sortedBy { it.verdict.ordinal }) {
            appendLine(if (f.verdict == Verdict.SUPPORTS) "[Destekliyor]" else "[Çürütüyor]")
            appendLine(quote(f.paragraph)).appendLine()
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
