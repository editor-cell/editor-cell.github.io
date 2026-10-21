import com.orbis.research.Evrak
import com.orbis.research.Paragraph
import kotlin.test.Test
import kotlin.test.assertEquals

/** The evrak joins the supporting paragraphs, word for word, document by document. */
class EvrakTest {
    private fun para(id: Long, text: String, url: String) = Paragraph(id, text, url, "Title $url", "2024-05-01", "WHO")

    @Test fun groupsByDocumentInTheDocumentsOrder() {
        val a = "https://who.int/a"
        val b = "https://oecd.org/b"
        val docs = Evrak.group(listOf(
            para(7, "Third paragraph of A.", a) to 6,
            para(1, "Only paragraph of B.", b) to 0,
            para(3, "First paragraph of A.", a) to 2,
            para(4, "Second paragraph of A, right after the first.", a) to 3,
            para(9, "  Only paragraph of B.  ", "https://oecd.org/b-copy") to 0,
        ))
        // A first (its paragraph was the best), then B; the copy of B's paragraph under another address is left out.
        assertEquals(listOf(a, b), docs.map { it.url })
        assertEquals(listOf("First paragraph of A.", "Second paragraph of A, right after the first.", "Third paragraph of A."), docs[0].parts.map { it.text })
        // "…" only where the document's text was skipped.
        assertEquals(listOf(false, false, true), docs[0].parts.map { it.gap })
        assertEquals("WHO", docs[1].source)
    }

    @Test fun namesTheFile() {
        assertEquals("Orbis-evrak-seker-vergisi-koyan-ulkelerde-gazli-2026-10-21.pdf",
            Evrak.fileName("Şeker vergisi koyan ülkelerde gazlı içecek tüketimi düştü.", "2026-10-21"))
    }
}
