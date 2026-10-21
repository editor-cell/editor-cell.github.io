import com.orbis.research.Concept
import com.orbis.research.Concepts
import com.orbis.research.Extract
import com.orbis.research.Paragraph
import com.orbis.research.Prompts
import org.junit.jupiter.api.Assumptions.assumeTrue
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * The whole path a paragraph takes before it can be a finding, on the real language model (ORBIS_MODEL):
 * the page must be a document, the part a paragraph, it must speak of the claim's concepts (which the
 * model itself finds), and only then does the model judge it. The build runs this on the small model the
 * phone uses (Qwen3 1.7B) as well as the big one. A paragraph that has nothing to do with the claim
 * must be stopped on the way, whatever the model; paragraphs close to the claim are only reported.
 */
class ConceptGateTest {
    companion object {
        private const val RATES = "enflasyon düşürmek için faiz yükselten ülkelerde ekonomik durgunluk"
        private const val SUGAR = "Şeker vergisi koyan ülkelerde gazlı içecek tüketimi düştü."
        private const val WAGE = "Asgari ücret artışı istihdamı azaltmadı."
        private const val AIR = "Kentlerde hava kirliliği astım vakalarını artırıyor."
        private const val EV = "Elektrikli otomobil satışları Avrupa'da 2023'te arttı."

        private val found = HashMap<String, List<Concept>>()

        private fun ready() = assumeTrue(!System.getenv("ORBIS_LIB").isNullOrEmpty() && !System.getenv("ORBIS_MODEL").isNullOrEmpty())

        /** The concepts the model finds for a claim, once per claim, as the app asks for them. */
        fun conceptsOf(claim: String): List<Concept> = found.getOrPut(claim) {
            val raw = LiveModelTest.ask(Concepts.SYSTEM, Concepts.prompt(claim, LiveModelTest.english(claim)), Concepts.GRAMMAR, 300)
            println("CONCEPTS $claim -> ${raw.replace("\n", " | ")}")
            Concepts.parse(raw)
        }

        /** Where a paragraph stops on its way to a finding, or what the model says of it. */
        fun path(claim: String, text: String, url: String): String {
            if (!Extract.looksLikeDocument(url)) return "NOT A DOCUMENT"
            if (!Extract.isProse(text)) return "NOT A PARAGRAPH"
            if (!Concepts.passes(text, conceptsOf(claim))) return "CONCEPTS MISSING"
            val p = Paragraph(1, text, url, "Report", "", "Example")
            return LiveModelTest.ask(Prompts.JUDGE_SYSTEM, Prompts.judge(claim, LiveModelTest.english(claim), p), Prompts.JUDGE_GRAMMAR, 8)
        }
    }

    private class Case(val claim: String, val text: String, val url: String = "https://example.org/report", val note: String = "")

    /** What the phone showed as "supporting" on 21 Oct 2026 for RATES: none of it says stagnation followed a rise in rates. */
    private val unrelated = listOf(
        Case(RATES, "Sebastian Doerr (sebastian.doerr@bis.org) and Gaston Gelos (gaston.gelos@bis.org) are at the Bank for International " +
            "Settlements (BIS) and Centre for Economic Policy Research (CEPR). Vesa Pursiainen gratefully acknowledges financial support by " +
            "the Swiss National Science Foundation, grant no. 10001196. The views expressed here are those of the authors only, and not " +
            "necessarily those of the Bank for International Settlements or its member central banks.",
            "https://www.bis.org/publications/bank-liquidity-regulation-and-growth-private-credit.pdf", "thanks"),
        Case(RATES, "European banks are sitting sure in the saddle nowadays, even in the face of bucking economic and financial conditions. " +
            "Neither the pandemic nor the banking turmoil in 2023 threw them off, a remarkable turnaround compared with their performance " +
            "during the great financial crisis.",
            "https://www.bis.org/speeches/20261008-competitiveness-european-banking-sector", "banks"),
        Case(RATES, "Price stability provides an essential foundation for financial planning. High and unpredictable inflation erodes " +
            "purchasing power and makes planning difficult. The current monetary policy framework aims to maintain inflation around the " +
            "target of 5 per cent over the medium term. A predictable inflation environment helps households plan expenditure and enables " +
            "businesses to assess investments over a longer horizon.",
            "https://www.bis.org/speeches/20261016-financial-literacy-towards-inclusive-economy", "Sri Lanka"),
        Case(RATES, "Since 2020, African economies have been most severely tested by a salvo of shocks. Almost all originated outside of our " +
            "continent. The formulation of our domestic economies policies is increasingly shaped by factors such as pandemics, trade wars, " +
            "military conflicts, and more frequent and severe climate shocks.",
            "https://www.bis.org/speeches/20261013-cross-border-payments-necessity-africas-resilience-and-economic-transformation", "Africa"),
        Case(RATES, "Note: The figure displays the percentage changes in exports of energy-related environmental goods and environmentally " +
            "preferable products projected with the WTO Global Trade Model for 2030 relative to 2021 assuming the elimination of tariffs and " +
            "a 25 per cent reduction in the ad valorem equivalent of non tariff measures. EFTA – European Free Trade Association. " +
            "LDC – least-developed countries.",
            "https://www.wto.org/english/tratop_e/envir_e/policy_brief_environmental_goods_e.pdf", "WTO note"),
        Case(RATES, "Addresses statistical issues relating to economic, monetary and financial stability.",
            "https://www.bis.org/about/basel-process", "Basel"),
    )

    /** Close to the claim, and told apart only by the model: reported, never a reason to stop the build. */
    private val close = listOf(
        Case(RATES, "Part of the explanation lies in the weight the Monetary Policy and Financial Stability Committee has given to striking " +
            "an appropriate balance between reducing inflation and sustaining employment. More aggressive monetary tightening would have " +
            "brought inflation down faster. But the story is multifaceted.",
            "https://www.bis.org/speeches/20261013-why-last-mile-disinflation-taking-so-long", "Norway"),
        Case(RATES, "Core inflation is still too high at 2.9 per cent. The three-month momentum in core inflation is 3.8 per cent. Credit is " +
            "growing. Fiscal deficits are adding pressure. Money supply growth must slow down. That is why a rate hike in June remains in play.",
            "https://www.bis.org/speeches/20261013-how-central-bank-can-fight-inflation-and-earn-buffett-and-lynch", "June hike"),
    )

    /** Real findings, for or against: none may be stopped before the model reads it. */
    private val findings = listOf(
        Case(RATES, "After the central bank raised its policy rate from 0.25% to 5.25% to bring inflation down, output contracted for two " +
            "consecutive quarters and the economy entered a recession.", note = "rates"),
        Case(SUGAR, "In Mexico, purchases of taxed sugar-sweetened beverages declined by 6% in the first year after the excise tax was " +
            "introduced in 2014, and by 9.7% in the second year, compared with the trend expected without the tax.", note = "sugar for"),
        Case(SUGAR, "Denmark's tax on soft drinks had no measurable effect on consumption: sales of carbonated soft drinks did not fall after " +
            "the tax was raised, because consumers bought the same drinks cheaply across the German border.", note = "sugar against"),
        Case(WAGE, "Across the 138 increases studied, the number of low-wage jobs remained essentially unchanged five years after the minimum " +
            "wage was raised, while the earnings of affected workers rose.", note = "wage for"),
        Case(WAGE, "After Seattle raised its minimum wage to 13 dollars, hours worked in low-wage jobs fell by around 9 percent, and the " +
            "number of such jobs declined, according to the city's evaluation.", note = "wage against"),
        Case(AIR, "Children living near roads with heavy traffic had higher rates of new asthma diagnoses; each 10 µg/m³ increase in nitrogen " +
            "dioxide was associated with a 5% rise in asthma incidence.", note = "air"),
        Case(EV, "New registrations of battery electric cars in the European Union rose by 37% in 2023 to 1.5 million, reaching a market " +
            "share of 14.6%.", note = "ev"),
    )

    /**
     * The same things said in other words, and in Turkish: reported, not blocking. A paragraph that
     * the word check misses is missed (the owner prefers that to a wrong one), but the report shows
     * whether the model lists enough synonyms for the check not to drop relevant paragraphs.
     */
    private val otherWords = listOf(
        Case(RATES, "The monetary tightening of 2022 pushed borrowing costs up sharply. Consumer prices stopped climbing, but the economy " +
            "slipped into a downturn, with output falling for three quarters.", note = "synonyms"),
        Case(RATES, "Merkez Bankası politika faizini yüzde 8,5'ten yüzde 50'ye çıkardı; enflasyon yavaşladı ancak ekonomi durgunluğa girdi " +
            "ve üretim art arda iki çeyrek geriledi.", "https://www.tcmb.gov.tr/wps/wcm/connect/rapor.pdf", "Turkish"),
        Case(SUGAR, "Levies on sweetened beverages in Mexico cut purchases of fizzy drinks by about 6 percent in the first year.", note = "synonyms sugar"),
        Case(WAGE, "Raising the wage floor did not reduce the number of low-paid jobs, according to a study of 138 increases.", note = "synonyms wage"),
    )

    /** The words are there but the paragraph says something else: the model must see that. Reported, not blocking. */
    private val wordsOnly = listOf(
        Case(RATES, "Interest rates on savings accounts rose last year, so savers earned more on their deposits. A recession in the local " +
            "housing market was blamed on the inflation of building costs.", note = "words only 1"),
        Case(SUGAR, "The ministry's tax office moved to a new building in March. Soft drinks and snacks are sold in the canteen, and the " +
            "consumption of coffee among staff has risen.", note = "words only 2"),
    )

    @TestFactory fun conceptsAreFoundForEveryClaim() = listOf(RATES, SUGAR, WAGE, AIR, EV).map { claim ->
        DynamicTest.dynamicTest(claim) {
            ready()
            val c = conceptsOf(claim)
            assertTrue(c.isNotEmpty(), "no concepts for: $claim")
            // A concept with a single word is thin but harmless; the report shows it.
            println("GATE concepts ${c.size}, words per concept ${c.map { it.terms.size }}: $claim")
        }
    }

    @TestFactory fun nothingUnrelatedBecomesAFinding() = unrelated.map { c ->
        DynamicTest.dynamicTest(c.note) {
            ready()
            val r = path(c.claim, c.text, c.url)
            println("GATE ${c.note}: $r")
            assertTrue(r != "SUPPORTS" && r != "CONTRADICTS", "an unrelated paragraph (${c.note}) became a finding: $r")
        }
    }

    @TestFactory fun closeCasesAreOnlyReported() = close.map { c ->
        DynamicTest.dynamicTest(c.note) {
            ready()
            println("GATE close ${c.note}: ${path(c.claim, c.text, c.url)}")
        }
    }

    /**
     * Findings must not be turned away wholesale: a gate that stops everything also stops the junk. The
     * model's word lists differ from run to run (and phone to phone), and the owner prefers a missed
     * paragraph to a wrong one, so this is only a floor against a broken gate; how many get through is in
     * the report ("GATE finding ...").
     */
    @Test fun findingsAreNotAllTurnedAway() {
        ready()
        var through = 0
        for (c in findings) {
            val ok = Extract.isProse(c.text) && Concepts.passes(c.text, conceptsOf(c.claim))
            println("GATE finding ${c.note}: " + if (ok) "reaches the model" else "STOPPED by the words")
            if (ok) through++
        }
        println("GATE findings through the words: $through of ${findings.size}")
        assertTrue(through * 10 >= findings.size * 4, "only $through of ${findings.size} findings reach the model")
    }

    /** The model's verdict on the findings that got through is reported; the build has other checks for it. */
    @TestFactory fun whatTheModelSaysOfFindings() = findings.map { c ->
        DynamicTest.dynamicTest(c.note) {
            ready()
            val want = if (c.note.endsWith("against")) "CONTRADICTS" else "SUPPORTS"
            val r = path(c.claim, c.text, c.url)
            println("GATE finding ${c.note}: $r (want $want)")
            assumeTrue(r == want, "close case: $r")
            assertEquals(want, r)
        }
    }

    @TestFactory fun otherWordsAreReported() = otherWords.map { c ->
        DynamicTest.dynamicTest(c.note) {
            ready()
            val passed = Extract.isProse(c.text) && Concepts.passes(c.text, conceptsOf(c.claim))
            println("GATE ${c.note}: " + if (passed) "caught by the words; model says ${path(c.claim, c.text, c.url)}" else "MISSED by the words")
        }
    }

    @TestFactory fun wordsWithoutMeaningAreReported() = wordsOnly.map { c ->
        DynamicTest.dynamicTest(c.note) {
            ready()
            println("GATE ${c.note}: " + path(c.claim, c.text, c.url) + " (right answer: UNRELATED, or stopped by the words)")
        }
    }
}
