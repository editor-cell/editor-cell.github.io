package com.orbis.research

enum class Verdict { SUPPORTS, CONTRADICTS }

/**
 * How one paragraph bears on the claim. [indirect]: the claim follows from the paragraph in one
 * step rather than being stated; [reason] names that step, and is dropped ([reasonDropped]) when it
 * carries a figure the paragraph does not.
 */
data class Judgement(val verdict: Verdict, val indirect: Boolean, val reason: String?, val reasonDropped: Boolean = false)

/**
 * Everything the app says to the model, kept free of Android so the tests run these exact prompts
 * against the real model. The quote shown is always the paragraph itself; the model only labels
 * it, and may add a one-line reason for an indirect finding and a one-line direction to try.
 */
object Prompts {
    /**
     * The start of the model's answer. Qwen3 thinks aloud first; an empty thinking block, as its
     * own template writes when thinking is off, makes it answer at once.
     */
    fun answerPrefix(modelPath: String) =
        if (modelPath.contains("qwen3", ignoreCase = true)) "<think>\n\n</think>\n\n" else ""

    /** Drops the thinking block Qwen3 may write before its answer. */
    fun clean(raw: String) = raw.replace(Regex("(?s)<think>.*?</think>"), "").trim()

    const val JUDGE_SYSTEM = "You are a careful fact-checker. You read one paragraph taken from a document and " +
        "decide how it bears on a claim. Use only what the paragraph itself says.\n" +
        "SUPPORTS: the paragraph shows the claim is true.\n" +
        "CONTRADICTS: the paragraph shows the claim is false, for example no effect, no change or the opposite.\n" +
        "UNRELATED: anything else, including paragraphs that only mention the topic, describe plans or " +
        "methods, or give no finding about the claim.\n" +
        "After SUPPORTS or CONTRADICTS write DIRECT if the paragraph says so outright, or INDIRECT if it " +
        "follows in one clear step from what the paragraph states, for example figures for two years that " +
        "show the change, or the same thing under another name. After INDIRECT write a colon and one short " +
        "sentence in Turkish naming that step, using only facts and figures that are in the paragraph."

    fun judge(claim: String, p: Paragraph): String =
        "Claim: $claim\n\nParagraph from \"${p.docTitle.take(200)}\":\n<<<\n${p.text.take(2000)}\n>>>\n\n" +
            "Answer with SUPPORTS DIRECT, SUPPORTS INDIRECT: <reason>, CONTRADICTS DIRECT, " +
            "CONTRADICTS INDIRECT: <reason>, or UNRELATED."

    const val JUDGE_GRAMMAR = "root ::= \"UNRELATED\" | verdict \" DIRECT\" | verdict \" INDIRECT: \" reason\n" +
        "verdict ::= \"SUPPORTS\" | \"CONTRADICTS\"\n" +
        "reason ::= [^\\n]+"

    /** The model's answer as a judgement; null when the paragraph does not bear on the claim. */
    fun parseJudgement(answer: String?, paragraph: String): Judgement? {
        val a = answer?.trim() ?: return null
        val verdict = when {
            a.startsWith("SUPPORTS") -> Verdict.SUPPORTS
            a.startsWith("CONTRADICTS") -> Verdict.CONTRADICTS
            else -> return null
        }
        val indirect = a.contains(" INDIRECT")
        if (!indirect) return Judgement(verdict, false, null)
        val reason = a.substringAfter("INDIRECT:", "").trim().ifEmpty { null }
        val ok = reason != null && numbersIn(reason).all { it in numbersIn(paragraph) }
        return Judgement(verdict, true, if (ok) reason else null, reasonDropped = reason != null && !ok)
    }

    /** Figures in a text, compared by their digits only: "9,7", "9.7" and "97" are one figure. */
    fun numbersIn(text: String): Set<String> =
        Regex("\\d+(?:[.,]\\d+)*").findAll(text).map { it.value.filter(Char::isDigit) }.toSet()

    const val SUGGEST_SYSTEM = "You help a researcher who searched a library of official reports and studies " +
        "for evidence about a claim."

    fun suggest(claim: String) = "Claim: $claim\n\nThe search found no paragraph that says outright whether this " +
        "claim is true. In one sentence in Turkish, suggest another direction for the research: a related, more " +
        "specific question, or another kind of measure or source to look at. Do not state any facts or figures."

    /** One line, and no digits: a direction to try, never a finding. */
    const val SUGGEST_GRAMMAR = "root ::= [^0-9\\n]+"
}
