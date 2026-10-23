import com.orbis.research.EvidenceDecision
import com.orbis.research.NliEngine
import com.orbis.research.Prompts
import org.junit.jupiter.api.Assumptions.assumeTrue
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

/** Semantic smoke checks on the unchanged latest checkpoint, not a claim of general accuracy. */
class ReadingRegressionTest {
    @Test fun reportedFalsePositiveIsWithheldAndClearEvidenceStillWorks() {
        val path = System.getenv("ORBIS_NLI_MODEL")
        assumeTrue(!path.isNullOrBlank())
        val claim = "obezite kalp krizi ihtimalini artırır"
        val reported = "Underweight - Weight is easy to measure; hence, this is the indicator for which most data have been collected in the past. The mortality risk is increased in children who are even mildly underweight, and the risk is even greater in severely underweight children."
        NliEngine(File(path!!)).use { model ->
            val labels = listOf("entailment", "neutral", "contradiction")
            val result = EvidenceDecision.fromLogits(model.logits(reported, claim), labels)
            println("Reported WHO paragraph: ${result.saved()}")
            assertEquals("UNCERTAIN", result.verdict)
            assertNull(Prompts.parseJudgement(result.saved(), reported, claim))
            for ((text, expected) in listOf(
                "Obesity increases the risk of heart attacks." to "SUPPORTS",
                "Obezite kalp krizi ihtimalini artırır." to "SUPPORTS",
                "Obesity does not increase the risk of heart attacks." to "CONTRADICTS",
                "Obezite kalp krizi ihtimalini artırmaz." to "CONTRADICTS",
                "Obesity increases the risk of knee pain." to "UNRELATED",
                "The library extended its opening hours to accommodate more readers." to "UNRELATED",
            )) {
                assertEquals(expected, EvidenceDecision.fromLogits(model.logits(text, claim), labels).verdict, text)
            }
        }
    }
}
