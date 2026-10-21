import com.orbis.research.LlmNative
import com.orbis.research.Vectors
import org.junit.jupiter.api.Assumptions.assumeTrue
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.TestFactory
import java.io.File
import kotlin.test.assertTrue

/**
 * Meaning search with a real embedding model (ORBIS_EMBED): for a Turkish claim, the English
 * paragraphs that say the same thing in other words must rank above unrelated ones.
 */
class EmbedderTest {
    companion object {
        private val model get() = System.getenv("ORBIS_EMBED") ?: ""
        private val engine: Long by lazy {
            System.load(File(System.getenv("ORBIS_LIB")).absolutePath)
            LlmNative.nativeInit("")
            LlmNative.nativeLoadEmbedder(model, 512).also { check(it != 0L) { "embedding model did not load" } }
        }
        private fun ready() = assumeTrue(!System.getenv("ORBIS_LIB").isNullOrEmpty() && model.isNotEmpty())

        private fun embed(text: String): FloatArray {
            val t = System.currentTimeMillis()
            val v = LlmNative.nativeEmbed(engine, text) ?: error("no vector for: $text")
            println("  [${System.currentTimeMillis() - t} ms]")
            return Vectors.normalize(v)
        }

        // Paragraphs that bear on a claim avoid the claim's own words where they can.
        private val claims = listOf(
            "Şeker vergisi koyan ülkelerde gazlı içecek tüketimi düştü." to listOf(
                "After the levy on sweetened soda was introduced, households bought noticeably fewer fizzy drinks.",
                "Purchases of taxed sugary beverages declined by 6% in the first year after the excise duty took effect in Mexico.",
                "Denmark repealed its soft drink duty after finding that consumption barely changed and shoppers crossed the border for cheaper cola.",
            ),
            "Asgari ücret artışı istihdamı azaltmadı." to listOf(
                "Raising the wage floor did not lead to fewer jobs for low-paid workers, the study of 138 increases found.",
                "Teenage employment in fast-food restaurants was unaffected when New Jersey lifted its lowest legal pay rate.",
                "After the pay floor rose to 13 dollars, hours worked in low-wage jobs fell by around 9 percent.",
            ),
            "Kentlerde hava kirliliği astım vakalarını artırıyor." to listOf(
                "Children living near busy roads, where nitrogen dioxide levels are high, were more often diagnosed with wheezing and chronic airway disease.",
                "Each rise in fine particulate matter in urban areas was associated with more emergency visits for breathing attacks.",
            ),
        )
        private val distractors = listOf(
            "Global sugar prices rose sharply in 2023 because of poor harvests in India and Thailand.",
            "Tobacco taxes were raised in 2019, and cigarette smuggling increased along the eastern border.",
            "The ministry will publish its annual report on road safety in March.",
            "Average rents in capital cities increased faster than wages over the last decade.",
            "Unemployment benefits were extended for six months during the pandemic.",
            "Forest fires in the Mediterranean burned a record area in the summer of 2021.",
            "The central bank kept interest rates unchanged at its October meeting.",
            "Vaccination rates against measles fell in several European countries.",
        )
        private val pool: List<String> by lazy { claims.flatMap { it.second } + distractors }
        private val poolVectors: List<ByteArray> by lazy { pool.map { Vectors.toBytes(embed(Vectors.docText(model, it))) } }
    }

    /** How long one full paragraph takes, the work done for every paragraph a phone collects. */
    @TestFactory fun paragraphSpeed() = listOf(DynamicTest.dynamicTest("paragraph of 1200 characters") {
        ready()
        val para = ("In the two years after the levy took effect, purchases of taxed drinks fell among all income groups, " +
            "with the largest falls among the poorest households, while purchases of untaxed drinks such as bottled water rose. ").repeat(6).take(1200)
        val times = (1..5).map { val t = System.nanoTime(); LlmNative.nativeEmbed(engine, Vectors.docText(model, para)); (System.nanoTime() - t) / 1_000_000 }
        println("PARAGRAPH ms: $times")
        assertTrue(times.isNotEmpty())
    })

    /**
     * Live search chooses which documents to open from their addresses alone: for a Turkish claim,
     * the address of a document on the subject must outrank the others.
     */
    @TestFactory fun choosesDocumentsByAddress() = listOf(
        "Şeker vergisi koyan ülkelerde gazlı içecek tüketimi düştü." to "https://www.who.int/publications/sugar-taxes-and-soft-drink-sales-evidence-review",
        "Asgari ücret artışı istihdamı azaltmadı." to "https://example.org/reports/minimum-wage-increases-and-employment-effects-2022",
        "Kentlerde hava kirliliği astım vakalarını artırıyor." to "https://example.org/health/urban-air-pollution-and-childhood-asthma-study",
    ).map { (claim, target) ->
        DynamicTest.dynamicTest(claim) {
            ready()
            val urls = listOf(
                "https://www.who.int/news/item/annual-report-on-road-safety-2023",
                "https://example.org/about-us/careers-and-vacancies",
                "https://example.org/statistics/consumer-price-index-monthly-release",
                "https://example.org/publications/vaccination-coverage-in-europe-2021",
                "https://example.org/news/central-bank-interest-rate-decision",
                "https://example.org/data/forest-fires-mediterranean-2021",
                target,
            )
            val q = embed(Vectors.queryText(model, claim))
            val ranked = urls.sortedByDescending { Vectors.score(Vectors.toBytes(embed(Vectors.docText(model, com.orbis.research.Extract.slugText(it)))), q) }
            println("ADDRESS RANK for $claim: ${ranked.indexOf(target) + 1} of ${urls.size}")
            assertTrue(ranked.indexOf(target) < 2, "ranked ${ranked.indexOf(target) + 1}: $ranked")
        }
    }

    @TestFactory fun findsParagraphsByMeaning() = claims.map { (claim, relevant) ->
        DynamicTest.dynamicTest(claim) {
            ready()
            val q = embed(Vectors.queryText(model, claim))
            val ranked = pool.indices.sortedByDescending { Vectors.score(poolVectors[it], q) }
            val ranks = relevant.map { r -> ranked.indexOf(pool.indexOf(r)) + 1 }
            println("RANKS for $claim: $ranks of ${pool.size}")
            // Every paragraph that bears on the claim within the first (number of them + 2) places.
            assertTrue(ranks.all { it <= relevant.size + 2 }, "ranks $ranks")
        }
    }
}
