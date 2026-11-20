package com.orbis.research

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.util.Locale

/**
 * The evraks kept on the phone (owner, 20 Nov 2026): each PDF the app makes is kept in one folder
 * with its text beside it, so the Evraklar screen can list them and search inside all of them.
 */
object EvrakLibrary {
    data class Item(val pdf: File, val claim: String, val day: String, val docs: Int, val paragraphs: Int, val text: String)
    data class Hit(val item: Item, val snippet: String)

    private val tr = Locale.forLanguageTag("tr")

    private fun dir(ctx: Context) = File(ctx.filesDir, "evraklar").apply { mkdirs() }

    /** Keeps a copy of [pdf] and its words; a later evrak with the same name replaces it. */
    fun save(ctx: Context, pdf: File, claim: String, day: String, sections: List<Pair<String, List<EvrakDoc>>>) {
        val kept = File(dir(ctx), pdf.name)
        pdf.copyTo(kept, overwrite = true)
        val text = buildString {
            appendLine(claim)
            for ((heading, docs) in sections) {
                appendLine(heading)
                for (d in docs) {
                    appendLine(d.title); appendLine(d.source); appendLine(d.url)
                    for (p in d.parts) { if (p.heading.isNotEmpty()) appendLine(p.heading); appendLine(p.text) }
                }
            }
        }
        val meta = JSONObject()
            .put("claim", claim).put("day", day)
            .put("docs", sections.sumOf { it.second.size })
            .put("paragraphs", sections.sumOf { s -> s.second.sumOf { it.parts.size } })
            .put("text", text)
        File(dir(ctx), pdf.name.removeSuffix(".pdf") + ".json").writeText(meta.toString())
    }

    /** Every kept evrak, newest first. */
    fun all(ctx: Context): List<Item> = dir(ctx).listFiles { f -> f.name.endsWith(".json") }.orEmpty().mapNotNull { f ->
        try {
            val o = JSONObject(f.readText())
            val pdf = File(f.parentFile, f.name.removeSuffix(".json") + ".pdf")
            if (!pdf.exists()) null
            else Item(pdf, o.optString("claim"), o.optString("day"), o.optInt("docs"), o.optInt("paragraphs"), o.optString("text"))
        } catch (e: Exception) { null }
    }.sortedByDescending { it.pdf.lastModified() }

    /** The evraks whose words hold [query], each with the line around its first match. */
    fun search(items: List<Item>, query: String): List<Hit> {
        val q = query.trim().lowercase(tr)
        if (q.isEmpty()) return items.map { Hit(it, "") }
        return items.mapNotNull { item ->
            val lower = item.text.lowercase(tr)
            val at = lower.indexOf(q)
            if (at < 0) null else {
                val from = maxOf(0, at - 70)
                val to = minOf(item.text.length, at + q.length + 90)
                val piece = item.text.substring(from, to).replace(Regex("\\s+"), " ").trim()
                Hit(item, (if (from > 0) "…" else "") + piece + (if (to < item.text.length) "…" else ""))
            }
        }
    }

    fun delete(item: Item) {
        item.pdf.delete()
        File(item.pdf.parentFile, item.pdf.name.removeSuffix(".pdf") + ".json").delete()
    }

    private fun uri(ctx: Context, file: File) = FileProvider.getUriForFile(ctx, ctx.packageName + ".files", file)

    /** Opens the PDF in the phone's PDF reader; falls back to the share sheet when there is none. */
    fun open(ctx: Context, file: File) {
        val view = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri(ctx, file), "application/pdf")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        try { ctx.startActivity(view) } catch (e: Exception) { EvrakPdf.share(ctx, file) }
    }
}
