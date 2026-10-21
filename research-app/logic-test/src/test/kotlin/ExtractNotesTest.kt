import com.orbis.research.Extract
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** What the phone returned as "supporting" on 21 Oct 2026 for a phrase about interest rates: parts that are not findings. */
class ExtractNotesTest {
    @Test fun thanksFundingAndFigureNotesAreNotParagraphs() {
        val junk = listOf(
            "Sebastian Doerr (sebastian.doerr@bis.org) and Gaston Gelos (gaston.gelos@bis.org) are at the Bank for " +
                "International Settlements (BIS) and Centre for Economic Policy Research (CEPR). Vesa Pursiainen gratefully " +
                "acknowledges financial support by the Swiss National Science Foundation, grant no. 10001196. The views " +
                "expressed here are those of the authors only, and not necessarily those of the Bank for International Settlements.",
            "We would like to thank Sergey Chernenko, Mathias Drehmann and conference and seminar participants for helpful " +
                "comments. Responsibility for all errors remains with the authors.",
            "Note: The figure displays the percentage changes in exports of energy-related environmental goods and " +
                "environmentally preferable products projected with the WTO Global Trade Model for 2030 relative to 2021 " +
                "assuming the elimination of tariffs. EFTA – European Free Trade Association. LDC – least-developed countries.",
            "Source: Authors' calculations based on national statistics for the period 2019 to 2024, with data for the first quarter.",
        )
        for (j in junk) assertFalse(Extract.isProse(j), j)
    }

    @Test fun findingsThatShareTheirWordsAreStillKept() {
        val prose = listOf(
            "After the central bank raised its policy rate from 0.25% to 5.25% to bring inflation down, output contracted " +
                "for two consecutive quarters and the economy entered a recession.",
            "Note that the tightening was followed by two quarters of falling output in most of the countries studied here.",
            "Sources of inflation include imports and wages, and the tightening that followed cut output for two years in the sample.",
            "The Federal Reserve acknowledges that its rate increases slowed growth in 2023, and employment growth fell as a result.",
        )
        for (p in prose) assertTrue(Extract.isProse(p), p)
    }

    @Test fun aboutPagesAreNotDocuments() {
        assertFalse(Extract.looksLikeDocument("https://www.bis.org/about/basel-process"))
        assertFalse(Extract.looksLikeDocument("https://www.example.org/contact"))
        assertTrue(Extract.looksLikeDocument("https://www.bis.org/speeches/20261013-why-last-mile-disinflation-taking-so-long"))
        assertTrue(Extract.looksLikeDocument("https://www.bis.org/publications/bank-liquidity-regulation-and-growth-private-credit.pdf"))
    }
}
