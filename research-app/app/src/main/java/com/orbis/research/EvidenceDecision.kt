package com.orbis.research

import java.util.Locale
import kotlin.math.exp

/** Preserve the model's winning label. Scores are recorded, never used as an extra filter. */
data class EvidenceDecision(val verdict: String, val probabilities: List<Double>) {
    fun saved(): String = verdict + "\nSCORES: " + probabilities.joinToString(",") { String.format(Locale.ROOT, "%.6f", it) }

    companion object {
        const val VERSION = ":reading-v3"

        fun fromLogits(logits: FloatArray, labels: List<String>): EvidenceDecision {
            require(logits.size == 3 && logits.all { it.isFinite() })
            require(labels.toSet() == setOf("entailment", "neutral", "contradiction") && labels.size == 3)
            val peak = logits.max()
            val weights = logits.map { exp(it.toDouble() - peak) }
            val sum = weights.sum()
            val probabilities = weights.map { it / sum }
            val best = logits.indices.maxBy { logits[it] }
            val verdict = when (labels[best]) {
                "entailment" -> "SUPPORTS"
                "contradiction" -> "CONTRADICTS"
                else -> "UNRELATED"
            }
            return EvidenceDecision(verdict, probabilities)
        }
    }
}
