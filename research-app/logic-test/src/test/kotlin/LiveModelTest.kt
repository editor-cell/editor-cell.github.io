import com.orbis.research.LlmNative
import com.orbis.research.Paragraph
import com.orbis.research.Prompts
import org.junit.jupiter.api.Assumptions.assumeTrue
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** The app's own prompts, through the app's own bridge, on the model the app recommends. */
class LiveModelTest {
    companion object {
        private val engine: Long by lazy {
            System.load(File(System.getenv("ORBIS_LIB")).absolutePath)
            LlmNative.nativeInit("")
            LlmNative.nativeLoad(System.getenv("ORBIS_MODEL"), 4096).also { check(it != 0L) { "model did not load" } }
        }
        private fun ready() = assumeTrue(!System.getenv("ORBIS_LIB").isNullOrEmpty() && !System.getenv("ORBIS_MODEL").isNullOrEmpty())

        private const val CLAIM = "Şeker vergisi koyan ülkelerde gazlı içecek tüketimi düştü."
        private val english by lazy {
            Prompts.firstLine(LlmNative.nativeGenerate(engine, Prompts.TRANSLATE_SYSTEM, Prompts.translate(CLAIM), "", 120)) ?: ""
        }
    }

    private fun judge(text: String): String {
        val p = Paragraph(1, text, "https://example.org/r", "Report", "", "Example")
        val a = LlmNative.nativeGenerate(engine, Prompts.JUDGE_SYSTEM, Prompts.judge(CLAIM, english, p), Prompts.JUDGE_GRAMMAR, 6)
        println("JUDGE ${a} <- ${text.take(70)}")
        return a ?: "null"
    }

    @Test fun translatesTheClaim() {
        ready()
        println("ENGLISH: $english")
        assertTrue(english.contains("sugar", true) && english.contains("tax", true), english)
    }

    @Test fun writesSearchPhrasesWithinTheGrammar() {
        ready()
        val out = LlmNative.nativeGenerate(engine, Prompts.PHRASES_SYSTEM, Prompts.phrases(english), Prompts.PHRASES_GRAMMAR, 120) ?: ""
        println("PHRASES:\n$out")
        val lines = out.lines().filter { it.isNotBlank() }
        assertTrue(lines.size in 3..8, out)
        assertTrue(lines.all { Regex("[a-zA-Z0-9][a-zA-Z0-9 '-]{1,48}").matches(it.trim()) }, out)
    }

    @Test fun supportingParagraph() {
        ready()
        assertEquals("SUPPORTS", judge(
            "In Mexico, purchases of taxed sugar-sweetened beverages declined by 6% in the first year after the excise tax " +
                "was introduced in 2014, and by 9.7% in the second year, compared with the trend expected without the tax."))
    }

    @Test fun contradictingParagraph() {
        ready()
        assertEquals("CONTRADICTS", judge(
            "Denmark's tax on soft drinks had no measurable effect on consumption: sales of carbonated soft drinks did not " +
                "fall after the tax was raised, because consumers bought the same drinks cheaply across the German border."))
    }

    @Test fun unrelatedParagraph() {
        ready()
        assertEquals("UNRELATED", judge(
            "The ministry will publish its annual report on road safety in March, covering traffic accidents, " +
                "speeding fines and the use of seat belts in rural areas."))
    }

    @Test fun topicWithoutFinding() {
        ready()
        assertEquals("UNRELATED", judge(
            "This chapter describes how prices of soft drinks and other beverages were collected in twelve countries, " +
                "and how the survey questionnaire was translated and tested before fieldwork began."))
    }
}
