import com.orbis.research.Extract
import com.orbis.research.Robots
import com.orbis.research.Sources
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class SourcesTest {
    @Test fun oneAddressPerLine() {
        val s = Sources.parse("who.int\nhttps://www.oecd.org/health/\n\n# a note\nhttp://data.worldbank.org")
        assertEquals(listOf("who.int", "oecd.org", "data.worldbank.org"), s.map { it.scope })
        assertEquals("https://www.oecd.org/health/", s[1].url)
    }

    @Test fun nameThenAddress() {
        val s = Sources.parse("World Health Organization, https://www.who.int\nOECD | oecd.org\nEurostat\thttps://ec.europa.eu/eurostat")
        assertEquals(listOf("World Health Organization", "OECD", "Eurostat"), s.map { it.name })
        assertEquals("ec.europa.eu", s[2].scope)
    }

    @Test fun commaSeparatedListAndDuplicates() {
        val s = Sources.parse("who.int, oecd.org, www.who.int, imf.org")
        assertEquals(listOf("who.int", "oecd.org", "imf.org"), s.map { it.scope })
    }

    @Test fun feedlyOpml() {
        val opml = """<?xml version="1.0"?><opml version="1.0"><body><outline text="Health">
            <outline type="rss" text="WHO news" title="WHO news" xmlUrl="https://www.who.int/rss-feeds/news-english.xml" htmlUrl="https://www.who.int"/>
            <outline type="rss" text="IMF &amp; blogs" xmlUrl="https://www.imf.org/en/Blogs/rss"/>
            </outline></body></opml>"""
        val s = Sources.parse(opml)
        assertEquals(listOf("who.int", "imf.org"), s.map { it.scope })
        assertEquals("WHO news", s[0].name)
        assertEquals("IMF & blogs", s[1].name)
        assertEquals("https://www.who.int/rss-feeds/news-english.xml", s[0].url)
    }

    @Test fun exportReadsBack() {
        val s = Sources.parse("Dünya Sağlık Örgütü, https://www.who.int\noecd.org")
        val again = Sources.parse(Sources.export(s.mapIndexed { i, x -> com.orbis.research.Source(i.toLong(), x.url, x.name, x.scope, 0) }))
        assertEquals(s, again)
    }

    @Test fun scopeCoversSubdomainsOnly() {
        val scopes = listOf("who.int", "oecd.org")
        assertTrue(Sources.inScope("www.who.int", scopes))
        assertTrue(Sources.inScope("iris.who.int", scopes))
        assertFalse(Sources.inScope("notwho.int", scopes))
        assertFalse(Sources.inScope("who.int.evil.com", scopes))
        assertFalse(Sources.inScope("google.com", scopes))
    }

    @Test fun headingsAfterTheAddress() {
        val s = Sources.parse("WHO, https://www.who.int, Sağlık; Çevre\nOECD | oecd.org | Ekonomi\nimf.org (IMF)\nwho.int, Halk sağlığı")
        assertEquals(listOf("Sağlık", "Çevre", "Halk sağlığı"), s[0].groups)
        assertEquals(listOf("Ekonomi"), s[1].groups)
        assertEquals(emptyList(), s[2].groups)
        assertEquals(3, s.size)
    }

    @Test fun feedlyFoldersBecomeHeadings() {
        val opml = """<?xml version="1.0"?><opml version="1.0"><body>
            <outline text="Sağlık" title="Sağlık">
              <outline type="rss" text="WHO" xmlUrl="https://www.who.int/rss-feeds/news-english.xml"/>
              <outline type="rss" text="CDC" xmlUrl="https://tools.cdc.gov/api/v2/resources/media/132608.rss"></outline>
            </outline>
            <outline text="Ekonomi"><outline type="rss" text="IMF" xmlUrl="https://www.imf.org/en/Blogs/rss"/></outline>
            <outline type="rss" text="Eurostat" xmlUrl="https://ec.europa.eu/eurostat/news/rss"/>
            </body></opml>"""
        val s = Sources.parse(opml).associate { it.name to it.groups }
        assertEquals(mapOf("WHO" to listOf("Sağlık"), "CDC" to listOf("Sağlık"), "IMF" to listOf("Ekonomi"), "Eurostat" to emptyList()), s)
    }

    @Test fun exportKeepsHeadings() {
        val src = listOf(
            com.orbis.research.Source(1, "https://www.who.int", "WHO", "who.int", 0, groups = listOf("Sağlık", "Çevre")),
            com.orbis.research.Source(2, "https://oecd.org", "OECD", "oecd.org", 0),
        )
        val back = Sources.parse(Sources.export(src))
        assertEquals(listOf(listOf("Sağlık", "Çevre"), emptyList()), back.map { it.groups })
        assertEquals(listOf("WHO", "OECD"), back.map { it.name })
    }

    @Test fun rejectsNonsense() {
        assertTrue(Sources.parse("hello world\njust words").isEmpty())
    }
}

class RobotsTest {
    private val txt = """
        User-agent: *
        Disallow: /private/
        Disallow: /*.json$
        Allow: /private/reports/

        User-agent: BadBot
        Disallow: /

        Sitemap: https://example.org/sitemap.xml
        Sitemap: https://example.org/news-sitemap.xml
    """.trimIndent()

    @Test fun rules() {
        val r = Robots.parse(txt, "OrbisResearch")
        assertTrue(r.allows("/publications/report-1"))
        assertFalse(r.allows("/private/x"))
        assertTrue(r.allows("/private/reports/2024.pdf"))
        assertFalse(r.allows("/data/a.json"))
        assertTrue(r.allows("/data/a.json?x=1"))
        assertFalse(Robots.parse(txt, "BadBot").allows("/anything"))
        assertTrue(Robots.parse("", "x").allows("/a"))
    }

    @Test fun sitemaps() {
        assertEquals(listOf("https://example.org/sitemap.xml", "https://example.org/news-sitemap.xml"), Robots.sitemaps(txt))
    }
}

class ExtractTest {
    private val long1 = "Taxes on sugar-sweetened beverages were followed by a 21% fall in purchases of taxed drinks in the first two years, according to the national household survey."
    private val long2 = "In Mexico, the excise tax of one peso per litre was associated with lower purchases among the poorest households, who reduced their purchases the most."

    @Test fun paragraphsAreKeptWordForWord() {
        val html = """<html><head><title>Report</title><meta name="citation_publication_date" content="2019/05/03">
            <meta name="citation_pdf_url" content="https://example.org/r.pdf"></head><body>
            <nav><p>Home About Contact Search our very long navigation menu with many many words in it</p></nav>
            <main><h1>Sugar taxes</h1><p>$long1</p><p>Short.</p>
            <ul><li>$long2</li><li><p>$long1</p></li></ul>
            <a href="/doc/annex.pdf">Annex</a><a href="https://other.org/x">x</a></main>
            <footer><p>Copyright notice that is long enough to be a paragraph but sits in the footer area.</p></footer></body></html>"""
        val p = Extract.html("https://example.org/report", html)
        assertEquals("Report", p.title)
        assertEquals("2019-05-03", p.date)
        assertEquals(listOf(long1, long2), p.paragraphs)
        assertTrue("https://example.org/doc/annex.pdf" in p.pdfLinks)
        assertTrue("https://example.org/r.pdf" in p.pdfLinks)
    }

    @Test fun pdfLinesJoined() {
        val text = "Executive summary\n\nTaxes on sugar-sweetened beverages were followed by a 21% fall\nin purchases of taxed drinks, according to the house-\nhold survey of 2018.${Extract.PARA}12\n"
        val p = Extract.pdfParagraphs(text)
        assertEquals(listOf("Taxes on sugar-sweetened beverages were followed by a 21% fall in purchases of taxed drinks, according to the house-hold survey of 2018."), p)
    }

    @Test fun longParagraphSplitBetweenSentences() {
        val s = (1..40).joinToString(" ") { "Sentence number $it says something about beverage taxes." }
        val parts = Extract.splitLong(s)
        assertTrue(parts.size > 1)
        assertEquals(s, parts.joinToString(" "))
        assertTrue(parts.all { it.length <= 1500 })
    }

    @Test fun sitemapIndexUrlsetRssAtom() {
        val idx = """<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <sitemap><loc>https://example.org/sm-2023.xml</loc></sitemap><sitemap><loc>https://example.org/sm-2024.xml</loc></sitemap></sitemapindex>"""
        assertEquals(listOf("https://example.org/sm-2023.xml", "https://example.org/sm-2024.xml"), Extract.listing(idx, "https://example.org/").sitemaps)
        val set = """<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.org/a</loc><lastmod>2024-03-01T10:00:00+00:00</lastmod></url>
            <url><loc>https://example.org/b</loc></url></urlset>"""
        assertEquals(listOf("https://example.org/a" to "2024-03-01", "https://example.org/b" to ""), Extract.listing(set, "https://example.org/").docs)
        val rss = """<rss version="2.0"><channel><item><title>T</title><link>https://example.org/n1</link><pubDate>Tue, 05 Mar 2024 09:00:00 GMT</pubDate></item></channel></rss>"""
        assertEquals(listOf("https://example.org/n1" to "2024-03-05"), Extract.listing(rss, "https://example.org/").docs)
        val atom = """<feed xmlns="http://www.w3.org/2005/Atom"><entry><link rel="alternate" href="https://example.org/e1"/><updated>2023-12-31T00:00:00Z</updated></entry></feed>"""
        assertEquals(listOf("https://example.org/e1" to "2023-12-31"), Extract.listing(atom, "https://example.org/").docs)
    }

    @Test fun documentAddresses() {
        assertTrue(Extract.looksLikeDocument("https://example.org/publications/report-2024"))
        assertTrue(Extract.looksLikeDocument("https://example.org/files/r.pdf"))
        assertFalse(Extract.looksLikeDocument("https://example.org/"))
        assertFalse(Extract.looksLikeDocument("https://example.org/img/a.png"))
        assertFalse(Extract.looksLikeDocument("https://example.org/tag/health"))
    }

    @Test fun feedLinks() {
        val html = """<html><head><link rel="alternate" type="application/rss+xml" href="/feed.xml"></head></html>"""
        assertEquals(listOf("https://example.org/feed.xml"), Extract.feedLinks(html, "https://example.org/"))
    }
}

class DateRangeTest {
    @Test fun partialDatesCountWhenAnyDayFits() {
        val r = com.orbis.research.DateRange("2020-06-01", "2021-06-15", includeUndated = false)
        assertTrue(r.contains("2020"))
        assertTrue(r.contains("2021-06"))
        assertTrue(r.contains("2021-06-15"))
        assertFalse(r.contains("2021-06-16"))
        assertFalse(r.contains("2019-05-03"))
        assertFalse(r.contains(""))
        assertTrue(r.copy(includeUndated = true).contains(""))
    }

    @Test fun openEndsAndLabels() {
        assertTrue(com.orbis.research.DateRange(from = "2023-01-01").contains("2030"))
        assertFalse(com.orbis.research.DateRange(to = "2010-12-31").contains("2011-01"))
        assertEquals("01.06.2020 – 15.06.2021", com.orbis.research.DateRange("2020-06-01", "2021-06-15").label())
        val y = com.orbis.research.DateRange.lastYears(5, java.time.LocalDate.of(2026, 10, 21))
        assertEquals("2021-10-21", y.from); assertEquals("2026-10-21", y.to)
    }
}
