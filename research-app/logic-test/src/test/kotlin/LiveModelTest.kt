import com.orbis.research.LlmNative
import com.orbis.research.Paragraph
import com.orbis.research.Prompts
import org.junit.jupiter.api.Assumptions.assumeTrue
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.TestFactory
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** The app's own prompts, through the app's own bridge, on a real model (ORBIS_MODEL). */
class LiveModelTest {
    companion object {
        private val model get() = System.getenv("ORBIS_MODEL") ?: ""
        private val engine: Long by lazy {
            System.load(File(System.getenv("ORBIS_LIB")).absolutePath)
            LlmNative.nativeInit("")
            LlmNative.nativeLoad(model, 4096).also { check(it != 0L) { "model did not load" } }
        }
        private fun ready() = assumeTrue(!System.getenv("ORBIS_LIB").isNullOrEmpty() && model.isNotEmpty())

        fun ask(system: String, user: String, grammar: String, max: Int): String {
            val t = System.currentTimeMillis()
            val out = LlmNative.nativeGenerate(engine, system, Prompts.forModel(model, user), grammar, max)?.let(Prompts::clean) ?: ""
            println("  [${System.currentTimeMillis() - t} ms]")
            return out
        }

        private val englishCache = HashMap<String, String>()
        fun english(claim: String) = englishCache.getOrPut(claim) {
            Prompts.firstLine(ask(Prompts.TRANSLATE_SYSTEM, Prompts.translate(claim), "", 120)) ?: ""
        }
    }

    /** Turkish claims and the English words a correct translation must contain (one of each group). */
    private val claims = listOf(
        "Şeker vergisi koyan ülkelerde gazlı içecek tüketimi düştü." to listOf("sugar", "tax", "soft drink|soda|carbonated|fizzy|beverage"),
        "Asgari ücret artışı istihdamı azaltmadı." to listOf("minimum wage", "employment|jobs"),
        "Kentlerde hava kirliliği astım vakalarını artırıyor." to listOf("air pollution", "asthma"),
        "Okul öncesi eğitim çocukların ileriki okul başarısını yükseltiyor." to listOf("preschool|pre-school|early childhood|kindergarten", "school"),
        "Elektrikli otomobil satışları Avrupa'da 2023'te arttı." to listOf("electric", "car|vehicle|automobile", "europe", "2023"),
    )

    @TestFactory fun translatesTurkishClaims() = claims.map { (claim, groups) ->
        DynamicTest.dynamicTest(claim) {
            ready()
            val en = english(claim)
            println("TRANSLATION: $claim -> $en")
            for (g in groups) assertTrue(Regex(g, RegexOption.IGNORE_CASE).containsMatchIn(en), "missing '$g' in: $en")
        }
    }

    @TestFactory fun writesSearchPhrasesWithinTheGrammar() = claims.take(2).map { (claim, _) ->
        DynamicTest.dynamicTest(claim) {
            ready()
            val out = ask(Prompts.PHRASES_SYSTEM, Prompts.phrases(english(claim)), Prompts.PHRASES_GRAMMAR, 120)
            println("PHRASES for $claim:\n$out")
            val lines = out.lines().filter { it.isNotBlank() }
            assertTrue(lines.size in 3..8, out)
            assertTrue(lines.all { Regex("[a-zA-Z][a-zA-Z0-9 '-]{1,48}").matches(it.trim()) }, out)
        }
    }

    private class Case(val claim: String, val expected: String, val text: String)

    private val cases = listOf(
        Case(claims[0].first, "SUPPORTS", "In Mexico, purchases of taxed sugar-sweetened beverages declined by 6% in the first year after the excise tax " +
            "was introduced in 2014, and by 9.7% in the second year, compared with the trend expected without the tax."),
        Case(claims[0].first, "CONTRADICTS", "Denmark's tax on soft drinks had no measurable effect on consumption: sales of carbonated soft drinks did not " +
            "fall after the tax was raised, because consumers bought the same drinks cheaply across the German border."),
        Case(claims[0].first, "UNRELATED", "The ministry will publish its annual report on road safety in March, covering traffic accidents, " +
            "speeding fines and the use of seat belts in rural areas."),
        Case(claims[0].first, "UNRELATED", "This chapter describes how prices of soft drinks and other beverages were collected in twelve countries, " +
            "and how the survey questionnaire was translated and tested before fieldwork began."),
        Case(claims[1].first, "SUPPORTS", "Across the 138 increases studied, the number of low-wage jobs remained essentially unchanged five years " +
            "after the minimum wage was raised, while the earnings of affected workers rose."),
        Case(claims[1].first, "CONTRADICTS", "After Seattle raised its minimum wage to 13 dollars, hours worked in low-wage jobs fell by around 9 percent, " +
            "and the number of such jobs declined, according to the city's evaluation."),
        Case(claims[2].first, "SUPPORTS", "Children living near roads with heavy traffic had higher rates of new asthma diagnoses; each 10 µg/m³ " +
            "increase in nitrogen dioxide was associated with a 5% rise in asthma incidence."),
        Case(claims[4].first, "SUPPORTS", "New registrations of battery electric cars in the European Union rose by 37% in 2023 to 1.5 million, " +
            "reaching a market share of 14.6%."),
    )

    @TestFactory fun judgesParagraphs() = cases.map { c ->
        DynamicTest.dynamicTest("${c.expected}: ${c.text.take(50)}") {
            ready()
            val p = Paragraph(1, c.text, "https://example.org/r", "Report", "", "Example")
            val a = ask(Prompts.JUDGE_SYSTEM, Prompts.judge(c.claim, english(c.claim), p), Prompts.JUDGE_GRAMMAR, 6)
            println("JUDGE expected ${c.expected}, got $a <- ${c.text.take(60)}")
            assertEquals(c.expected, a)
        }
    }
}
