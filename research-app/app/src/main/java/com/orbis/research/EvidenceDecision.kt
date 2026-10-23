package com.orbis.research

import java.util.Locale
import kotlin.math.exp

/** Model scores are not calibrated probabilities of truth. Abstain on ambiguous label scores. */
data class EvidenceDecision(val verdict: String, val probabilities: List<Double>) {
    fun saved(): String = verdict + "\nSCORES: " + probabilities.joinToString(",") { String.format(Locale.ROOT, "%.6f", it) }

    companion object {
        const val VERSION = ":reading-v2"
        // A provisional abstention policy, not an accuracy claim or a replacement for evaluation.
        const val MIN_SCORE = 0.80
        const val MIN_MARGIN = 0.20

        fun withContext(paragraph: EvidenceDecision, context: EvidenceDecision): String =
            (if (paragraph.verdict == context.verdict) paragraph.saved()
             else "UNCERTAIN\nPARAGRAPH: " + paragraph.saved()) + "\nCONTEXT: " + context.saved()

        fun fromLogits(logits: FloatArray, labels: List<String>): EvidenceDecision {
            require(logits.size == 3 && logits.all { it.isFinite() })
            require(labels.toSet() == setOf("entailment", "neutral", "contradiction") && labels.size == 3)
            val peak = logits.max()
            val weights = logits.map { exp(it.toDouble() - peak) }
            val sum = weights.sum()
            val probabilities = weights.map { it / sum }
            val order = probabilities.indices.sortedByDescending { probabilities[it] }
            val best = order[0]
            val verdict = when {
                labels[best] == "neutral" -> "UNRELATED"
                probabilities[best] < MIN_SCORE || probabilities[best] - probabilities[order[1]] < MIN_MARGIN -> "UNCERTAIN"
                labels[best] == "entailment" -> "SUPPORTS"
                else -> "CONTRADICTS"
            }
            return EvidenceDecision(verdict, probabilities)
        }
    }
}
