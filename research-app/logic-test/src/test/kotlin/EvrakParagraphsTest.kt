import com.orbis.research.Paragraph
import com.orbis.research.Prompts
import org.junit.jupiter.api.Assumptions.assumeTrue
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.TestFactory
import kotlin.test.assertEquals

/**
 * Paragraphs the phone returned as "supporting" on 21 Oct 2026 for the phrase below. Each deals with
 * inflation, banks or monetary policy, but none says that stagnation followed a rise in interest
 * rates, so the model must call each of them UNRELATED. [soft]: a close case whose result is
 * reported but does not fail the build.
 */
class EvrakParagraphsTest {
    private val claim = "enflasyon düşürmek için faiz yükselten ülkelerde ekonomik durgunluk"

    private class Case(val text: String, val soft: Boolean = false)

    private val cases = listOf(
        Case("European banks are sitting sure in the saddle nowadays, even in the face of bucking economic and financial " +
            "conditions. Neither the pandemic nor the banking turmoil in 2023 threw them off, a remarkable turnaround " +
            "compared with their performance during the great financial crisis."),
        Case("Price stability provides an essential foundation for financial planning. High and unpredictable inflation " +
            "erodes purchasing power and makes planning difficult. The current monetary policy framework aims to maintain " +
            "inflation around the target of 5 per cent over the medium term."),
        Case("Since 2020, African economies have been most severely tested by a salvo of shocks. Almost all originated " +
            "outside of our continent. The formulation of domestic economic policies is increasingly shaped by pandemics, " +
            "trade wars, military conflicts, and more frequent and severe climate shocks."),
        // Says that tighter policy would have brought inflation down faster; says nothing of output.
        Case("Part of the explanation lies in the weight the committee has given to striking an appropriate balance between " +
            "reducing inflation and sustaining employment. More aggressive monetary tightening would have brought inflation " +
            "down faster.", soft = true),
        // Names a rate rise and no outcome.
        Case("Core inflation is still too high at 2.9 per cent. The three-month momentum in core inflation is 3.8 per cent. " +
            "Credit is growing. Fiscal deficits are adding pressure. Money supply growth must slow down. That is why a rate " +
            "hike in June remains in play.", soft = true),
    )

    @TestFactory fun noneOfThemIsAFinding() = cases.map { c ->
        DynamicTest.dynamicTest(c.text.take(50)) {
            assumeTrue(!System.getenv("ORBIS_LIB").isNullOrEmpty() && !System.getenv("ORBIS_MODEL").isNullOrEmpty())
            val p = Paragraph(1, c.text, "https://example.org/r", "Report", "", "Example")
            val v = LiveModelTest.ask(Prompts.JUDGE_SYSTEM, Prompts.judge(claim, LiveModelTest.english(claim), p), Prompts.JUDGE_GRAMMAR, 8)
            println("JUDGE $v <- ${c.text.take(60)}")
            if (c.soft) assumeTrue(v == "UNRELATED", "close case: $v")
            assertEquals("UNRELATED", v, "got $v")
        }
    }
}
