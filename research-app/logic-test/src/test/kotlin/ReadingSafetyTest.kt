import com.orbis.research.EvidenceDecision
import com.orbis.research.Prompts
import com.orbis.research.SearchSelection
import com.orbis.research.Verdict
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class ReadingSafetyTest {
    private val labels = listOf("entailment", "neutral", "contradiction")

    @Test fun ambiguousAndTiedScoresDoNotBecomeEvidence() {
        for (scores in listOf(floatArrayOf(0f, 0f, 0f), floatArrayOf(0.8f, -0.2f, -1.46f))) {
            val decision = EvidenceDecision.fromLogits(scores, labels)
            assertEquals("UNCERTAIN", decision.verdict)
            assertNull(Prompts.parseJudgement(decision.saved(), "Any original paragraph."))
        }
    }

    @Test fun confidentEvidenceSurvivesWithScoresAndCorrectLabelOrder() {
        val yes = EvidenceDecision.fromLogits(floatArrayOf(7f, -6f, -5f), labels)
        val no = EvidenceDecision.fromLogits(floatArrayOf(7f, -6f, -5f), listOf("contradiction", "neutral", "entailment"))
        assertEquals(Verdict.SUPPORTS, Prompts.parseJudgement(yes.saved(), "Original.")?.verdict)
        assertEquals(Verdict.CONTRADICTS, Prompts.parseJudgement(no.saved(), "Original.")?.verdict)
        assertFailsWith<IllegalArgumentException> { EvidenceDecision.fromLogits(floatArrayOf(Float.NaN, 0f, 1f), labels) }
        assertFailsWith<IllegalArgumentException> { EvidenceDecision.fromLogits(floatArrayOf(0f, 0f, 1f), listOf("entailment", "entailment", "neutral")) }
    }

    @Test fun contextDisagreementCannotEnterTheEvidenceDocument() {
        val yes = EvidenceDecision.fromLogits(floatArrayOf(7f, -6f, -5f), labels)
        val no = EvidenceDecision.fromLogits(floatArrayOf(-6f, -5f, 7f), labels)
        assertNull(Prompts.parseJudgement(EvidenceDecision.withContext(yes, no), "Some say X. However, X is not true."))
        assertEquals(Verdict.SUPPORTS, Prompts.parseJudgement(EvidenceDecision.withContext(yes, yes), "Original.")?.verdict)
    }

    @Test fun sourcesDoNotStarveBehindTheFirstSourcesQueue() {
        assertEquals(listOf("a1", "b1", "c1", "a2", "c2", "a3"),
            SearchSelection.roundRobin(listOf(listOf("a1", "a2", "a3"), listOf("b1"), emptyList(), listOf("c1", "c2"))).toList())
        val items = listOf("a1", "a2", "a3", "b1", "c1", "b2")
        assertEquals(listOf("a1", "b1", "c1"), SearchSelection.diverse(items, 3) { it.first() })
        assertEquals(listOf("a1", "a2", "b1", "c1"), SearchSelection.diverse(items, 4) { it.first() })
        assertEquals(emptyList(), SearchSelection.diverse(items, 0) { it.first() })
    }
}
