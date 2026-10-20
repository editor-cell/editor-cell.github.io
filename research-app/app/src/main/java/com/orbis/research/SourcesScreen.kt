package com.orbis.research

import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private enum class Dialog { NONE, ONE, MANY, REMOVE, RENAME }

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SourcesScreen() {
    val ctx = LocalContext.current
    val db = remember { Db.get(ctx) }
    val scope = rememberCoroutineScope()
    var list by remember { mutableStateOf(emptyList<Source>()) }
    var selected by remember { mutableStateOf(emptySet<Long>()) }
    var filter by remember { mutableStateOf("") }
    var dialog by remember { mutableStateOf(Dialog.NONE) }
    var renaming by remember { mutableStateOf<Source?>(null) }

    fun reload() = scope.launch { list = withContext(Dispatchers.IO) { db.sources() } }
    LaunchedEffect(Unit) { reload() }

    fun addAll(inputs: List<SourceInput>) = scope.launch {
        if (inputs.isEmpty()) { Toast.makeText(ctx, "Geçerli bir adres bulunamadı.", Toast.LENGTH_LONG).show(); return@launch }
        val added = withContext(Dispatchers.IO) { db.addSources(inputs) }
        val dup = inputs.size - added
        Toast.makeText(ctx, "$added kaynak eklendi" + if (dup > 0) ", $dup tanesi zaten listedeydi." else ".", Toast.LENGTH_LONG).show()
        reload()
    }

    val importFile = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) scope.launch {
            val text = withContext(Dispatchers.IO) {
                try { ctx.contentResolver.openInputStream(uri)?.use { it.readBytes().toString(Charsets.UTF_8) } } catch (e: Exception) { null }
            }
            if (text == null) Toast.makeText(ctx, "Dosya açılamadı.", Toast.LENGTH_LONG).show()
            else addAll(Sources.parse(text))
        }
    }
    val exportFile = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/plain")) { uri ->
        if (uri != null) scope.launch {
            val ok = withContext(Dispatchers.IO) {
                try { ctx.contentResolver.openOutputStream(uri)?.use { it.write(Sources.export(list).toByteArray()) }; true } catch (e: Exception) { false }
            }
            Toast.makeText(ctx, if (ok) "${list.size} kaynak dosyaya yazıldı." else "Dosyaya yazılamadı.", Toast.LENGTH_LONG).show()
        }
    }

    val shown = list.filter { filter.isBlank() || it.name.contains(filter, true) || it.url.contains(filter, true) }

    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        Text("Kaynaklar (${list.size})", style = MaterialTheme.typography.headlineSmall, modifier = Modifier.padding(top = 16.dp))
        Text(
            "Araç yalnız bu sitelerin içinde arar. Bir site, alt adresleriyle birlikte sayılır.",
            style = MaterialTheme.typography.bodySmall,
        )
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(vertical = 8.dp)) {
            Button(onClick = { dialog = Dialog.ONE }) { Text("Tek ekle") }
            Button(onClick = { dialog = Dialog.MANY }) { Text("Toplu ekle") }
            OutlinedButton(onClick = { importFile.launch(arrayOf("text/*", "application/*")) }) { Text("Dosyadan ekle") }
            OutlinedButton(onClick = { exportFile.launch("orbis-kaynaklar.txt") }, enabled = list.isNotEmpty()) { Text("Dosyaya kaydet") }
        }
        if (list.size > 8) {
            OutlinedTextField(filter, { filter = it }, label = { Text("Listede bul") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        }

        Surface(tonalElevation = 2.dp, modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(4.dp)) {
                val allShownSelected = shown.isNotEmpty() && shown.all { it.id in selected }
                Checkbox(allShownSelected, onCheckedChange = {
                    selected = if (allShownSelected) selected - shown.map { it.id }.toSet() else selected + shown.map { it.id }
                })
                Text(if (selected.isEmpty()) "Tümünü seç" else "${selected.size} seçili", Modifier.weight(1f))
                if (selected.isNotEmpty()) {
                    TextButton(onClick = { CollectWorker.start(ctx, selected); Toast.makeText(ctx, "Seçilenlerden belge toplanıyor.", Toast.LENGTH_SHORT).show() }) { Text("Topla") }
                    TextButton(onClick = { dialog = Dialog.REMOVE }) { Text("Çıkar", color = MaterialTheme.colorScheme.error) }
                }
            }
        }

        if (list.isEmpty()) {
            Text(
                "Henüz kaynak yok. Bir adres ekleyin, bir listeyi yapıştırın ya da bir dosya seçin " +
                    "(her satırda bir adres; \"Ad, adres\" biçimi ve Feedly'den alınan OPML dosyası da olur).",
                modifier = Modifier.padding(top = 16.dp),
            )
        }
        LazyColumn(Modifier.fillMaxSize()) {
            items(shown, key = { it.id }) { s ->
                val on = s.id in selected
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth().clickable { selected = if (on) selected - s.id else selected + s.id }.padding(vertical = 4.dp),
                ) {
                    Checkbox(on, onCheckedChange = { selected = if (on) selected - s.id else selected + s.id })
                    Column(Modifier.weight(1f)) {
                        Text(s.name, style = MaterialTheme.typography.bodyLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(s.url, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text("${s.docCount} belge okundu", style = MaterialTheme.typography.labelSmall)
                    }
                    TextButton(onClick = { renaming = s; dialog = Dialog.RENAME }) { Text("Ad") }
                }
                HorizontalDivider()
            }
        }
    }

    when (dialog) {
        Dialog.ONE -> {
            var url by remember { mutableStateOf("") }
            var name by remember { mutableStateOf("") }
            AlertDialog(
                onDismissRequest = { dialog = Dialog.NONE },
                title = { Text("Kaynak ekle") },
                text = {
                    Column {
                        OutlinedTextField(url, { url = it }, label = { Text("Adres (ör. who.int)") }, singleLine = true)
                        Spacer(Modifier.height(8.dp))
                        OutlinedTextField(name, { name = it }, label = { Text("Ad (isteğe bağlı)") }, singleLine = true)
                    }
                },
                confirmButton = {
                    TextButton(onClick = {
                        dialog = Dialog.NONE
                        addAll(listOfNotNull(Sources.toSource(url.trim(), name.trim().ifEmpty { null })))
                    }) { Text("Ekle") }
                },
                dismissButton = { TextButton(onClick = { dialog = Dialog.NONE }) { Text("Vazgeç") } },
            )
        }
        Dialog.MANY -> {
            var text by remember { mutableStateOf("") }
            val parsed = remember(text) { Sources.parse(text) }
            AlertDialog(
                onDismissRequest = { dialog = Dialog.NONE },
                title = { Text("Toplu ekle") },
                text = {
                    Column {
                        Text("Adresleri yapıştırın: her satıra bir tane ya da virgülle ayrılmış.", style = MaterialTheme.typography.bodySmall)
                        OutlinedTextField(text, { text = it }, modifier = Modifier.fillMaxWidth().heightIn(min = 160.dp, max = 320.dp))
                        Text("${parsed.size} adres bulundu", style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(top = 4.dp))
                    }
                },
                confirmButton = {
                    TextButton(enabled = parsed.isNotEmpty(), onClick = { dialog = Dialog.NONE; addAll(parsed) }) { Text("${parsed.size} kaynağı ekle") }
                },
                dismissButton = { TextButton(onClick = { dialog = Dialog.NONE }) { Text("Vazgeç") } },
            )
        }
        Dialog.REMOVE -> {
            val chosen = list.filter { it.id in selected }
            val docs = chosen.sumOf { it.docCount }
            AlertDialog(
                onDismissRequest = { dialog = Dialog.NONE },
                title = { Text("${chosen.size} kaynak çıkarılsın mı?") },
                text = { Text("Bu kaynaklardan telefona alınmış $docs belge de silinir; aramalarda artık çıkmazlar.") },
                confirmButton = {
                    TextButton(onClick = {
                        dialog = Dialog.NONE
                        val ids = selected
                        scope.launch {
                            withContext(Dispatchers.IO) { db.removeSources(ids) }
                            selected = emptySet()
                            reload()
                        }
                    }) { Text("Çıkar", color = MaterialTheme.colorScheme.error) }
                },
                dismissButton = { TextButton(onClick = { dialog = Dialog.NONE }) { Text("Vazgeç") } },
            )
        }
        Dialog.RENAME -> {
            val s = renaming
            var name by remember { mutableStateOf(s?.name ?: "") }
            AlertDialog(
                onDismissRequest = { dialog = Dialog.NONE },
                title = { Text("Kaynağın adı") },
                text = { OutlinedTextField(name, { name = it }, singleLine = true) },
                confirmButton = {
                    TextButton(onClick = {
                        dialog = Dialog.NONE
                        if (s != null && name.isNotBlank()) scope.launch {
                            withContext(Dispatchers.IO) { db.renameSource(s.id, name.trim()) }
                            reload()
                        }
                    }) { Text("Kaydet") }
                },
                dismissButton = { TextButton(onClick = { dialog = Dialog.NONE }) { Text("Vazgeç") } },
            )
        }
        Dialog.NONE -> {}
    }
}
