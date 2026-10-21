package com.orbis.research

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.os.Build
import android.provider.MediaStore
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import androidx.core.content.FileProvider
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.common.PDRectangle
import com.tom_roush.pdfbox.pdmodel.interactive.action.PDActionURI
import com.tom_roush.pdfbox.pdmodel.interactive.annotation.PDAnnotationLink
import com.tom_roush.pdfbox.pdmodel.interactive.annotation.PDBorderStyleDictionary
import java.io.File
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/** Writes the evrak as an A4 PDF whose addresses can be tapped, and hands it to the phone. */
object EvrakPdf {
    private const val W = 595
    private const val H = 842
    private const val M = 50f

    private class Link(val page: Int, val rect: RectF, val url: String)

    /**
     * Makes the PDF in the app's own folder and returns it. [sections]: a heading and its documents,
     * the supporting ones first and then those that go against the claim; an empty one says so.
     */
    fun write(ctx: Context, claim: String, sections: List<Pair<String, List<EvrakDoc>>>): File {
        val day = LocalDate.now()
        val dir = File(ctx.cacheDir, "evrak").apply { mkdirs(); listFiles()?.forEach { it.delete() } }
        val file = File(dir, Evrak.fileName(claim, day.toString()))

        val pdf = PdfDocument()
        val links = ArrayList<Link>()
        val lineWidth = (W - 2 * M).toInt()
        var pageNo = 0
        var page = pdf.startPage(PdfDocument.PageInfo.Builder(W, H, ++pageNo).create())
        var y = M

        fun paint(size: Float, face: Typeface, color: Int = Color.BLACK) =
            TextPaint(TextPaint.ANTI_ALIAS_FLAG).apply { textSize = size; typeface = face; this.color = color }

        /** Lays [text] out line by line, starting a new page where one is full. */
        fun block(text: String, p: TextPaint, after: Float, link: String? = null, extraSpacing: Float = 1f) {
            val layout = StaticLayout.Builder.obtain(text, 0, text.length, p, lineWidth)
                .setAlignment(Layout.Alignment.ALIGN_NORMAL).setLineSpacing(0f, extraSpacing).build()
            for (i in 0 until layout.lineCount) {
                val top = layout.getLineTop(i).toFloat()
                val h = layout.getLineBottom(i) - top
                if (y + h > H - M) {
                    pdf.finishPage(page)
                    page = pdf.startPage(PdfDocument.PageInfo.Builder(W, H, ++pageNo).create())
                    y = M
                }
                val c = page.canvas
                c.save()
                c.translate(M, y - top)
                c.clipRect(0f, top, lineWidth.toFloat(), top + h)
                layout.draw(c)
                c.restore()
                if (link != null) links += Link(pageNo - 1, RectF(M, y, M + layout.getLineRight(i), y + h), link)
                y += h
            }
            y += after
        }

        val serif = Typeface.SERIF
        val bold = Typeface.create(Typeface.SERIF, Typeface.BOLD)
        val gray = Color.rgb(90, 90, 90)
        val blue = Color.rgb(20, 70, 160)

        block("ORBIS · EVRAK", paint(9f, Typeface.DEFAULT_BOLD, gray), 6f)
        block(claim, paint(16f, bold), 4f)
        block(day.format(DateTimeFormatter.ofPattern("dd.MM.yyyy")), paint(9f, Typeface.DEFAULT, gray), 18f)

        for ((heading, docs) in sections) {
          block(heading.uppercase(java.util.Locale.forLanguageTag("tr")), paint(13f, Typeface.DEFAULT_BOLD), 10f)
          if (docs.isEmpty()) block("Bu aramada bulunamadı.", paint(10f, Typeface.DEFAULT, gray), 18f)
          for ((n, d) in docs.withIndex()) {
            block("${n + 1}. ${d.title}", paint(12f, bold), 2f)
            val meta = listOf(d.source, d.date).filter { it.isNotBlank() }.joinToString(" · ")
            if (meta.isNotEmpty()) block(meta, paint(9f, Typeface.DEFAULT, gray), 1f)
            block(d.url, paint(8.5f, Typeface.DEFAULT, blue), 8f, link = d.url)
            for (part in d.parts) {
                if (part.gap) block("…", paint(11f, serif, gray), 4f)
                block(part.text, paint(11f, serif), 8f, extraSpacing = 1.15f)
            }
            y += 12f
          }
          y += 10f
        }
        pdf.finishPage(page)
        file.outputStream().use { pdf.writeTo(it) }
        pdf.close()

        // Android's PDF writer cannot make links; the addresses are made tappable afterwards.
        val tmp = File(dir, "tmp.pdf")
        try {
            PDFBoxResourceLoader.init(ctx.applicationContext)
            PDDocument.load(file).use { doc ->
                for (l in links) {
                    val annotation = PDAnnotationLink().apply {
                        rectangle = PDRectangle(l.rect.left, H - l.rect.bottom, l.rect.width(), l.rect.height())
                        borderStyle = PDBorderStyleDictionary().apply { width = 0f }
                        action = PDActionURI().apply { uri = l.url }
                    }
                    doc.getPage(l.page).annotations.add(annotation)
                }
                doc.save(tmp)
            }
            if (tmp.length() > 0) tmp.renameTo(file)
        } catch (e: Exception) {
            // The addresses stay as text; most PDF readers still open them.
        }
        return file
    }

    /** Keeps a copy in Downloads; true when it was saved. */
    fun saveToDownloads(ctx: Context, file: File): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return false
        return try {
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, file.name)
                put(MediaStore.Downloads.MIME_TYPE, "application/pdf")
            }
            val uri = ctx.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: return false
            ctx.contentResolver.openOutputStream(uri)?.use { out -> file.inputStream().use { it.copyTo(out) } }
            true
        } catch (e: Exception) { false }
    }

    /** Opens the phone's share sheet (Gemini, WhatsApp, Drive…) with the PDF. */
    fun share(ctx: Context, file: File) {
        val uri = FileProvider.getUriForFile(ctx, ctx.packageName + ".files", file)
        val send = Intent(Intent.ACTION_SEND).apply {
            type = "application/pdf"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        ctx.startActivity(Intent.createChooser(send, "Evrakı paylaş").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}
