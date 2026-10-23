import com.orbis.research.EvidenceDecision
import com.orbis.research.NliEngine
import org.junit.jupiter.api.Assumptions.assumeTrue
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals

/** Model-output parity and basic semantic checks; known classification errors are not corrected here. */
class ReadingRegressionTest {
    @Test fun modelVerdictIsNotSuppressedAndClearEvidenceStillWorks() {
        val path = System.getenv("ORBIS_NLI_MODEL")
        assumeTrue(!path.isNullOrBlank())
        val claim = "obezite kalp krizi ihtimalini artırır"
        val reported = "Underweight - Weight is easy to measure; hence, this is the indicator for which most data have been collected in the past. The mortality risk is increased in children who are even mildly underweight, and the risk is even greater in severely underweight children."
        NliEngine(File(path!!)).use { model ->
            val labels = listOf("entailment", "neutral", "contradiction")
            val raw = model.logits(reported, claim)
            val result = EvidenceDecision.fromLogits(raw, labels)
            println("Reported WHO paragraph: ${result.saved()}")
            // This paragraph is semantically unrelated. Preserve and report the model's known
            // mistake rather than silently replacing its decision with a confidence policy.
            val expected = mapOf("entailment" to "SUPPORTS", "neutral" to "UNRELATED", "contradiction" to "CONTRADICTS")
                .getValue(labels[raw.indices.maxBy { raw[it] }])
            assertEquals(expected, result.verdict)
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
