import com.orbis.research.LlmNative
import com.orbis.research.Paragraph
import com.orbis.research.Prompts
import com.orbis.research.Verdict
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
            LlmNative.nativeLoad(model, 2048).also { check(it != 0L) { "model did not load" } }
        }
        private fun ready() = assumeTrue(!System.getenv("ORBIS_LIB").isNullOrEmpty() && model.isNotEmpty())

        fun ask(system: String, user: String, grammar: String, max: Int): String {
            val t = System.currentTimeMillis()
            val out = LlmNative.nativeGenerate(engine, system, user, grammar, Prompts.answerPrefix(model), max)?.let(Prompts::clean) ?: ""
            println("  [${System.currentTimeMillis() - t} ms]")
            return out
        }

        private val englishCache = HashMap<String, String>()
        /** The app's translation step, once per claim. */
        fun english(claim: String) = englishCache.getOrPut(claim) {
            Prompts.firstLine(ask(Prompts.TRANSLATE_SYSTEM, Prompts.translate(claim), "", 60)) ?: ""
        }

        private const val SUGAR = "Şeker vergisi koyan ülkelerde gazlı içecek tüketimi düştü."
        private const val WAGE = "Asgari ücret artışı istihdamı azaltmadı."
        private const val AIR = "Kentlerde hava kirliliği astım vakalarını artırıyor."
        private const val EV = "Elektrikli otomobil satışları Avrupa'da 2023'te arttı."
        // Typed on the phone on 21 Oct 2026 as a phrase, not a sentence.
        private const val RATES = "enflasyon düşürmek için faiz yükselten ülkelerde ekonomik durgunluk"
    }

    /**
     * expected: SUPPORTS, CONTRADICTS or UNRELATED; indirect: the claim follows in one step; soft: a
     * subtle case whose result is reported but does not fail the build (missing it is the safe error).
     */
    private class Case(val claim: String, val expected: String, val text: String, val indirect: Boolean = false, val soft: Boolean = false)

    private val cases = listOf(
        Case(SUGAR, "SUPPORTS", "In Mexico, purchases of taxed sugar-sweetened beverages declined by 6% in the first year after the excise tax " +
            "was introduced in 2014, and by 9.7% in the second year, compared with the trend expected without the tax."),
        Case(SUGAR, "CONTRADICTS", "Denmark's tax on soft drinks had no measurable effect on consumption: sales of carbonated soft drinks did not " +
            "fall after the tax was raised, because consumers bought the same drinks cheaply across the German border."),
        Case(SUGAR, "UNRELATED", "The ministry will publish its annual report on road safety in March, covering traffic accidents, " +
            "speeding fines and the use of seat belts in rural areas."),
        Case(SUGAR, "UNRELATED", "This chapter describes how prices of soft drinks and other beverages were collected in twelve countries, " +
            "and how the survey questionnaire was translated and tested before fieldwork began."),
        Case(SUGAR, "SUPPORTS", "Sales of carbonated soft drinks were 120 litres per person in 2017 and 95 litres per person in 2020; " +
            "the levy on sugary drinks took effect in April 2018.", indirect = true),
        Case(WAGE, "SUPPORTS", "Across the 138 increases studied, the number of low-wage jobs remained essentially unchanged five years " +
            "after the minimum wage was raised, while the earnings of affected workers rose."),
        Case(WAGE, "CONTRADICTS", "After Seattle raised its minimum wage to 13 dollars, hours worked in low-wage jobs fell by around 9 percent, " +
            "and the number of such jobs declined, according to the city's evaluation."),
        Case(WAGE, "SUPPORTS", "Retail and hospitality employed 2.10 million people in the month before the 2019 minimum wage rise " +
            "and 2.14 million people twelve months later.", indirect = true, soft = true),
        Case(AIR, "SUPPORTS", "Children living near roads with heavy traffic had higher rates of new asthma diagnoses; each 10 µg/m³ " +
            "increase in nitrogen dioxide was associated with a 5% rise in asthma incidence."),
        Case(RATES, "SUPPORTS", "After the central bank raised its policy rate from 0.25% to 5.25% to bring inflation down, output " +
            "contracted for two consecutive quarters and the economy entered a recession."),
        Case(RATES, "UNRELATED", "© Bank for International Settlements 2026. All rights reserved. Brief excerpts may be reproduced " +
            "or translated provided the source is stated."),
        Case(RATES, "UNRELATED", "Rising unemployment and falling house prices are two of the scenarios banks must model in the " +
            "stress test; if financial institutions fail a test, they must adjust their capital plans."),
        Case(EV, "SUPPORTS", "New registrations of battery electric cars in the European Union rose by 37% in 2023 to 1.5 million, " +
            "reaching a market share of 14.6%."),
    )

    /** Turkish claims and the English words a correct translation must contain (one of each group). */
    private val translations = listOf(
        SUGAR to listOf("sugar", "tax", "drink|soda|beverage"),
        WAGE to listOf("minimum wage", "employment|jobs"),
        AIR to listOf("air pollution", "asthma"),
        "Okul öncesi eğitim çocukların ileriki okul başarısını yükseltiyor." to listOf("preschool|pre-school|early childhood|kindergarten", "school"),
        EV to listOf("electric", "car|vehicle|automobile", "europe", "2023"),
    )

    @TestFactory fun translatesTurkishClaims() = translations.map { (claim, groups) ->
        DynamicTest.dynamicTest(claim) {
            ready()
            val en = english(claim)
            println("TRANSLATION: $claim -> $en")
            for (g in groups) assertTrue(Regex(g, RegexOption.IGNORE_CASE).containsMatchIn(en), "missing '$g' in: $en")
        }
    }

    @TestFactory fun judgesParagraphs() = cases.map { c ->
        DynamicTest.dynamicTest("${c.expected}${if (c.indirect) " (indirect)" else ""}: ${c.text.take(46)}") {
            ready()
            val p = Paragraph(1, c.text, "https://example.org/r", "Report", "", "Example")
            // The app's two steps: the verdict, then for a paragraph that bears on the claim, how.
            val en = english(c.claim)
            val v = ask(Prompts.JUDGE_SYSTEM, Prompts.judge(c.claim, en, p), Prompts.JUDGE_GRAMMAR, 8)
            val a = when (v) {
                "SUPPORTS" -> v + "\n" + ask(Prompts.JUDGE_SYSTEM, Prompts.how(c.claim, en, p, Verdict.SUPPORTS), Prompts.HOW_GRAMMAR, 100)
                "CONTRADICTS" -> v + "\n" + ask(Prompts.JUDGE_SYSTEM, Prompts.how(c.claim, en, p, Verdict.CONTRADICTS), Prompts.HOW_GRAMMAR, 100)
                else -> v
            }
            println("JUDGE ${a.replace("\n", " | ")} <- ${c.text.take(60)}")
            val j = Prompts.parseJudgement(a, c.text)
            if (c.soft) assumeTrue(j?.verdict?.name == c.expected, "subtle case missed: $a")
            assertEquals(c.expected, j?.verdict?.name ?: "UNRELATED", "got $a")
            // A reason may only use figures from the paragraph; one that does not is hidden in the app
            // (JudgementTest checks that). Here it is only reported: the model sometimes infers a year.
            if (j != null && j.reasonDropped) println("HIDDEN REASON (figure not in the paragraph): ${a.replace("\n", " | ")}")
        }
    }

    /**
     * A paragraph that supports the claim on its own, read with its neighbours: kept when the
     * document stands behind it, dropped when the document sets it out to refute it.
     */
    private class StanceCase(val before: String?, val middle: String, val after: String?, val expected: String, val soft: Boolean = false)

    private val stances = listOf(
        StanceCase("Common myths about children's diet",
            "Many parents believe that eating sugar makes children hyperactive and unable to concentrate.",
            "However, controlled studies have found no difference in behaviour between children given sugar and children given a placebo.",
            "REFUTED"),
        StanceCase(null, cases[0].text,
            "The decline was larger among low-income households, who bought 9% fewer taxed drinks in the first year.", "OWN"),
        StanceCase("Myth: raising the minimum wage always destroys jobs.",
            "When the minimum wage rises, employers cut jobs because labour becomes more expensive.",
            "Fact: most studies of recent increases find little or no effect on the number of jobs.", "REFUTED", soft = true),
        StanceCase(null, "New registrations of battery electric cars in the European Union rose by 37% in 2023 to 1.5 million.",
            "However, growth slowed in the second half of the year as purchase subsidies ended in Germany.", "OWN", soft = true),
    )

    @TestFactory fun readsParagraphsInContext() = stances.map { c ->
        DynamicTest.dynamicTest("${c.expected}: ${c.middle.take(50)}") {
            ready()
            val p = Paragraph(1, c.middle, "https://example.org/r", "Report", "", "Example")
            val s = ask(Prompts.JUDGE_SYSTEM, Prompts.stance(p, c.before, c.after), Prompts.STANCE_GRAMMAR, 8).trim()
            println("STANCE $s <- ${c.middle.take(60)}")
            if (c.soft) assumeTrue(s == c.expected, "subtle case missed: $s")
            assertEquals(c.expected, s)
        }
    }

    /**
     * Kıyas: a paragraph about a comparable case elsewhere, for a claim it does not speak to. The
     * model must give the four parts with the right direction, and stay out of unrelated paragraphs.
     */
    private class AnalogyCase(val claim: String, val text: String, val expected: String)

    private val analogies = listOf(
        AnalogyCase("Türkiye'de sigara vergisi artırılırsa sigara tüketimi azalır.",
            "After France raised tobacco taxes sharply between 2003 and 2004, cigarette sales fell by a third.", "SUPPORTS"),
        AnalogyCase("Türkiye'de şekerli içeceklere vergi konursa bu içeceklerin tüketimi azalır.",
            "In Mexico, purchases of taxed sugar-sweetened beverages declined by 6% in the first year after the excise tax was introduced in 2014.", "SUPPORTS"),
        AnalogyCase("Türkiye'de şekerli içeceklere vergi konursa bu içeceklerin tüketimi azalır.",
            "The ministry will publish its annual report on road safety in March, covering traffic accidents and speeding fines.", "NONE"),
    )

    @TestFactory fun reasonsByAnalogy() = analogies.map { c ->
        DynamicTest.dynamicTest("${c.expected}: ${c.text.take(50)}") {
            ready()
            val p = Paragraph(1, c.text, "https://example.org/r", "Report", "", "Example")
            val raw = ask(Prompts.JUDGE_SYSTEM, Prompts.analogy(c.claim, english(c.claim), p), Prompts.ANALOGY_GRAMMAR, 180)
            println("ANALOGY ${raw.replace("\n", " | ")} <- ${c.text.take(60)}")
            val j = Prompts.parseJudgement(Prompts.withAnalogy(raw), c.text, c.claim)
            if (c.expected == "NONE") assertEquals(null, j, "an analogy from an unrelated paragraph: $raw")
            else {
                assertTrue(raw.startsWith(c.expected), "expected ${c.expected}: $raw")
                if (j == null) println("HIDDEN ANALOGY (a figure not in the paragraph or claim): ${raw.replace("\n", " | ")}")
            }
        }
    }

    @TestFactory fun suggestsADirection() = listOf(SUGAR, WAGE).map { claim ->
        DynamicTest.dynamicTest(claim) {
            ready()
            val s = ask(Prompts.SUGGEST_SYSTEM, Prompts.suggest(claim), Prompts.SUGGEST_GRAMMAR, 70)
            println("SUGGESTION: $s")
            assertTrue(s.length >= 20 && s.none { it.isDigit() } && !s.contains('\n'), s)
        }
    }

    /** "Durdur" must end an answer within a second, even while the model is still reading a long prompt. */
    @TestFactory fun stopsAtOnce() = listOf(800L, 4000L).map { wait ->
        DynamicTest.dynamicTest("stop after $wait ms") {
            ready()
            check(engine != 0L)  // load the model first, so the stop lands on an answer being written
            var out: String? = "unset"
            val long = "Summarise this text in 300 words. " + "Rivers carry water from the hills to the sea and shape the land they cross. ".repeat(40)
            val t = Thread { out = LlmNative.nativeGenerate(engine, "You write long summaries.", long, "", Prompts.answerPrefix(model), 300) }
            t.start()
            Thread.sleep(wait)
            val asked = System.currentTimeMillis()
            LlmNative.nativeAbort(engine)
            t.join(30_000)
            val took = System.currentTimeMillis() - asked
            t.join()  // never let a late answer run into the next test on the same engine
            println("STOP after $wait ms took $took ms")
            assertTrue(!t.isAlive && took < 1500, "still running after $took ms")
            assertEquals(null, out)
            // The engine still answers correctly after a stop.
            val p = Paragraph(1, cases[0].text, "https://example.org/r", "Report", "", "Example")
            val again = ask(Prompts.JUDGE_SYSTEM, Prompts.judge(SUGAR, english(SUGAR), p), Prompts.JUDGE_GRAMMAR, 8)
            assertEquals(Verdict.SUPPORTS, Prompts.parseJudgement(again, p.text)?.verdict, "after stop: $again")
        }
    }
}
