package com.orbis.research

import kotlin.math.sqrt

/**
 * Meaning vectors. Each is scaled to length 1 and kept as one signed byte per dimension, so a
 * paragraph costs a few hundred bytes and a phone can compare a claim with every paragraph at once.
 */
object Vectors {
    fun normalize(v: FloatArray): FloatArray {
        var sum = 0.0
        for (x in v) sum += x * x
        val n = sqrt(sum).toFloat().takeIf { it > 0f } ?: 1f
        return FloatArray(v.size) { v[it] / n }
    }

    fun toBytes(unit: FloatArray): ByteArray =
        ByteArray(unit.size) { (unit[it] * 127f).toInt().coerceIn(-127, 127).toByte() }

    /** Similarity of a stored paragraph vector and a claim vector (both length 1): higher is closer. */
    fun score(stored: ByteArray, query: FloatArray): Float {
        val n = minOf(stored.size, query.size)
        var s = 0f
        for (i in 0 until n) s += stored[i] * query[i]
        return s / 127f
    }

    /**
     * What the embedding model is told about each text. These models were trained with such
     * labels, and a claim is matched against passages, not against other claims.
     */
    fun queryText(modelPath: String, text: String): String {
        val m = modelPath.lowercase()
        return when {
            "embeddinggemma" in m -> "task: search result | query: $text"
            "qwen3-embedding" in m -> "Instruct: Given a claim, retrieve passages from reports and studies that support or contradict it\nQuery:$text"
            "e5" in m -> "query: $text"
            else -> text
        }
    }

    fun docText(modelPath: String, text: String): String {
        val m = modelPath.lowercase()
        return when {
            "embeddinggemma" in m -> "title: none | text: $text"
            "e5" in m -> "passage: $text"
            else -> text
        }
    }
}
