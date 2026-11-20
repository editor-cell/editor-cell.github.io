package com.orbis.research

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** The evraks kept on the phone, newest first, with a search inside all of them (owner, 20 Nov 2026). */
@Composable
fun EvraklarScreen() {
    val ctx = LocalContext.current
    var query by rememberSaveable { mutableStateOf("") }
    var refresh by remember { mutableIntStateOf(0) }
    var items by remember { mutableStateOf(emptyList<EvrakLibrary.Item>()) }
    var removing by remember { mutableStateOf<EvrakLibrary.Item?>(null) }
    LaunchedEffect(refresh) { items = withContext(Dispatchers.IO) { EvrakLibrary.all(ctx) } }
    val hits = remember(items, query) { EvrakLibrary.search(items, query) }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(horizontal = 24.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Row(verticalAlignment = Alignment.Bottom) {
                Text("Evraklar", style = MaterialTheme.typography.headlineMedium, modifier = Modifier.weight(1f))
                Text("${items.size} evrak", style = MaterialTheme.typography.bodySmall)
            }
        }
        item {
            OutlinedTextField(
                query, { query = it }, modifier = Modifier.fillMaxWidth(), singleLine = true,
                shape = RoundedCornerShape(14.dp), placeholder = { Text("Evraklarda ara") },
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant) },
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = MaterialTheme.colorScheme.surface, unfocusedContainerColor = MaterialTheme.colorScheme.surface,
                    unfocusedBorderColor = MaterialTheme.colorScheme.outlineVariant,
                ),
            )
        }
        if (items.isEmpty()) item {
            Text("Henüz evrak yok.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else if (hits.isEmpty()) item {
            Text("Bu evraklarda geçmiyor.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if (hits.isNotEmpty()) item {
            Column(Modifier.fillMaxWidth().border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(16.dp))
                .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(16.dp))) {
                hits.forEachIndexed { i, hit ->
                    if (i > 0) HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    EvrakRow(hit, onOpen = { EvrakLibrary.open(ctx, hit.item.pdf) },
                        onShare = { EvrakPdf.share(ctx, hit.item.pdf) }, onDelete = { removing = hit.item })
                }
            }
        }
        item { Spacer(Modifier.height(24.dp)) }
    }

    removing?.let { item ->
        AlertDialog(
            onDismissRequest = { removing = null },
            title = { Text("Evrak silinsin mi?") },
            text = { Text(item.claim) },
            confirmButton = { TextButton(onClick = { EvrakLibrary.delete(item); removing = null; refresh++ }) { Text("Sil") } },
            dismissButton = { TextButton(onClick = { removing = null }) { Text("Vazgeç") } },
        )
    }
}

@Composable
private fun EvrakRow(hit: EvrakLibrary.Hit, onOpen: () -> Unit, onShare: () -> Unit, onDelete: () -> Unit) {
    val item = hit.item
    Row(Modifier.fillMaxWidth().clickable(onClick = onOpen).padding(start = 16.dp, top = 12.dp, bottom = 12.dp, end = 4.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(40.dp).background(MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(10.dp)),
            contentAlignment = Alignment.Center) {
            Text("PDF", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.primary)
        }
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(item.claim, fontSize = 15.sp, fontWeight = FontWeight.Medium, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(listOf(dayLabel(item.day), "${item.docs} belge", "${item.paragraphs} paragraf").filter { it.isNotBlank() }.joinToString(" · "),
                fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (hit.snippet.isNotEmpty()) Text(hit.snippet, fontSize = 13.sp, maxLines = 3, overflow = TextOverflow.Ellipsis,
                color = MaterialTheme.colorScheme.onSurface)
        }
        IconButton(onClick = onShare) { Icon(Icons.Filled.Share, contentDescription = "Paylaş", tint = MaterialTheme.colorScheme.onSurfaceVariant) }
        IconButton(onClick = onDelete) { Icon(Icons.Filled.Delete, contentDescription = "Sil", tint = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}

/** 2026-11-19 as 19.11.2026. */
private fun dayLabel(day: String): String {
    val p = day.split('-')
    return if (p.size == 3) "${p[2]}.${p[1]}.${p[0]}" else day
}
