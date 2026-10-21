package com.orbis.research

enum class Verdict { SUPPORTS, CONTRADICTS }

/**
 * How one paragraph bears on the claim. [indirect]: the claim follows from the paragraph in one
 * step rather than being stated; [reason] names that step, and is dropped ([reasonDropped]) when it
 * carries a figure the paragraph does not.
 */
data class Judgement(
    val verdict: Verdict, val indirect: Boolean, val reason: String?, val reasonDropped: Boolean = false,
    /** Set when the finding is the model's analogy (kıyas), not evidence in the paragraph. */
    val analogy: Analogy? = null,
)

/**
 * A kıyas, as in usul: the case the paragraph knows ([asil]) and its outcome, the case the claim
 * is about ([fer]), the cause the two share ([illet]), and what follows for the claim ([hukum]),
 * worded as a likelihood. All four are the model's words; the paragraph is shown beside them.
 */
data class Analogy(val asil: String, val fer: String, val illet: String, val hukum: String)

/**
 * Everything the app says to the model, kept free of Android so the tests run these exact prompts
 * against the real model. The quote shown is always the paragraph itself; the model only labels
 * it, and may add a one-line reason for an indirect finding, an analogy (kıyas) set apart from the
 * evidence, and a one-line direction to try.
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

    const val TRANSLATE_SYSTEM = "You are a professional Turkish-English translator. You translate a statement into " +
        "accurate English, keeping every term's exact meaning. Output only the translation."

    /** The claim in English as well: the small model judges English paragraphs better with it. */
    fun translate(claim: String) = "Translate into English. If it is already English, repeat it unchanged. " +
        "Keep its form: a statement stays a statement, a question stays a question, a topic stays a topic.\n\n" +
        "Example: Tütün vergisini artıran ülkelerde sigara içme oranı azaldı.\n" +
        "Translation: In countries that raised tobacco taxes, smoking rates fell.\n\n" +
        "$claim\nTranslation:"

    fun firstLine(raw: String?) = raw?.lines()?.firstOrNull { it.isNotBlank() }?.trim()
        ?.removePrefix("Translation:")?.trim()?.trim('"')

    const val JUDGE_SYSTEM = "You are a careful fact-checker. You read one paragraph taken from a document and " +
        "decide how it bears on a claim. Use only what the paragraph itself says.\n" +
        "SUPPORTS: the paragraph reports a finding, figure or evidence showing the claim is true.\n" +
        "CONTRADICTS: the paragraph reports a finding, figure or evidence showing the claim is false, " +
        "or that the effect was absent or the opposite.\n" +
        "UNRELATED: anything else, including paragraphs that only mention the topic, describe plans or " +
        "methods, or give no finding about the claim. A title, a reference to another publication, a copyright " +
        "or legal notice, a sentence cut off in the middle, or a paragraph that only shares some words or the " +
        "general subject with the claim is always UNRELATED. When in doubt, answer UNRELATED.\n" +
        "A claim, question or topic often joins two things: a measure or cause, and what followed it (\"in countries " +
        "that did X, Y happened\"). A paragraph that deals with only one of the two, or that gives the measure " +
        "but not what followed, is always UNRELATED.\n" +
        "The claim may also be a question or a topic instead of a statement. Then SUPPORTS means the paragraph " +
        "answers the question or gives concrete information on the topic (a definition, a finding, a figure, what " +
        "a country did and what followed); CONTRADICTS is not used, and anything else is UNRELATED."

    private fun claimAndParagraph(claim: String, english: String?, p: Paragraph): String {
        val c = if (english.isNullOrBlank() || english.equals(claim, ignoreCase = true)) claim else "$claim\n(English: $english)"
        return "Claim: $c\n\nParagraph from \"${p.docTitle.take(200)}\":\n<<<\n${p.text.take(2000)}\n>>>\n\n"
    }

    /** Step one: does the paragraph bear on the claim? One word. */
    fun judge(claim: String, english: String?, p: Paragraph): String = claimAndParagraph(claim, english, p) +
        "Does this paragraph show the claim is true (SUPPORTS), show it is false, for example no effect, " +
        "no change or the opposite (CONTRADICTS), or neither (UNRELATED)? If the claim is a question or a topic: " +
        "does the paragraph answer it or give concrete information on it (SUPPORTS), or not (UNRELATED)? " +
        "Answer with one word."

    const val JUDGE_GRAMMAR = "root ::= \"SUPPORTS\" | \"CONTRADICTS\" | \"UNRELATED\""

    /**
     * Step one read for meaning, the owner's way (21 Oct 2026): the word check has already found the
     * claim's words, or words that mean the same, in the paragraph; that alone proves nothing. The
     * model first writes down what the claim says happened and what the paragraph itself reports,
     * and only then whether the two match. The verdict follows from Match, not from a one-word guess.
     * Being tried against [judge] before the app uses it.
     */
    fun read(claim: String, english: String?, p: Paragraph): String = claimAndParagraph(claim, english, p) +
        "The claim's words, or words that mean the same, appear in this paragraph. That alone proves nothing: " +
        "read what the paragraph actually says before you decide. Write three lines.\n" +
        "Claim: in a few words, what the claim says happened (the measure or cause, and what followed it). " +
        "If the claim is a question or a topic, what it asks about.\n" +
        "Says: in one short sentence of your own, what the paragraph itself reports: who did what, and what followed. " +
        "If it only names the subject, a plan, a target or a view, say so.\n" +
        "Match: same (the paragraph reports both parts of the claim, linked, as the claim says), opposite (it reports " +
        "both, but no effect or the opposite followed), answers (the claim is a question or topic and the paragraph " +
        "answers it or gives concrete information on it), or no (anything else, including a paragraph on the same " +
        "subject that does not report what the claim says)."

    const val READ_GRAMMAR = "root ::= \"Claim: \" line \"\\nSays: \" line \"\\nMatch: \" match\n" +
        "line ::= [^\\n]{1,220}\n" +
        "match ::= \"same\" | \"opposite\" | \"answers\" | \"no\""

    /** A paragraph's sentences in their order, cut where a sentence ends and the next begins. */
    fun sentences(text: String): List<String> =
        Regex("(?<=[.!?])\\s+(?=[A-Z0-9\"“(])").split(text.trim()).map { it.trim() }.filter { it.isNotEmpty() }

    /**
     * The owner's second idea (21 Oct 2026), the hafız's way: a hafız learns a page by heart from its
     * last line. The paragraph is given in its own order, its sentences numbered, and the model goes
     * from the last sentence back to the first, giving each one a fixed mark and no words of its own
     * (the owner: a summary in a few words would only be its own inference again); the grammar holds
     * it to every sentence, so none can be skipped. Only then does it say whether the paragraph matches
     * the claim. Tried beside [read].
     */
    fun readBackwards(claim: String, english: String?, p: Paragraph): String {
        val c = if (english.isNullOrBlank() || english.equals(claim, ignoreCase = true)) claim else "$claim\n(English: $english)"
        val numbered = sentences(p.text.take(2000)).mapIndexed { i, s -> "${i + 1}. $s" }.joinToString("\n")
        val n = sentences(p.text.take(2000)).size
        return "Claim: $c\n\nParagraph from \"${p.docTitle.take(200)}\", its sentences numbered in order:\n<<<\n$numbered\n>>>\n\n" +
            "The claim's words, or words that mean the same, appear in this paragraph. That alone proves nothing. " +
            "Read the paragraph the way a hafız learns a page by heart: start from the last sentence and go back to the " +
            "first, one sentence at a time, from sentence $n down to sentence 1. Do not summarise any sentence. Give each " +
            "one only a mark, for what that sentence itself states:\n" +
            "cause: it states that the claim's measure or cause was taken or happened.\n" +
            "outcome: it states that what the claim says followed did happen.\n" +
            "both: it states both, linked.\n" +
            "opposite: it states that after the claim's measure or cause, no such effect or the opposite followed.\n" +
            "answers: the claim is a question or topic and this sentence answers it or gives concrete information on it.\n" +
            "rejects: it rejects, refutes or corrects what the sentences before it said.\n" +
            "none: anything else, including a sentence that only shares the subject, names a plan, a target or a view.\n" +
            "Then write Match: same (the paragraph states both parts of the claim, linked, as the claim says, and does " +
            "not reject them), opposite (it states the claim's measure or cause, but no effect or the opposite), answers " +
            "(it answers the question or informs on the topic), or no (anything else)."
    }

    /** Holds the model to every sentence, from the last to the first, with a mark and nothing else. */
    fun readBackwardsGrammar(text: String): String {
        val n = sentences(text.take(2000)).size.coerceAtLeast(1)
        val steps = (n downTo 1).joinToString(" ") { "\"S$it: \" mark \"\\n\"" }
        return "root ::= $steps \"Match: \" match\n" +
            "mark ::= \"cause\" | \"outcome\" | \"both\" | \"opposite\" | \"answers\" | \"rejects\" | \"none\"\n" +
            "match ::= \"same\" | \"opposite\" | \"answers\" | \"no\""
    }

    /** Room for a mark on every sentence and the match. */
    fun readBackwardsMax(text: String) = (12 + 6 * sentences(text.take(2000)).size).coerceAtMost(200)

    /** Room for the short lines and the match. */
    const val READ_MAX = 160

    /** The verdict a reading arrives at, in step one's words; null when the reading did not finish. */
    fun verdictOfReading(raw: String?): String? =
        when (raw?.substringAfterLast("Match:", "")?.trim()?.substringBefore('\n')?.trim()) {
            "same", "answers" -> "SUPPORTS"
            "opposite" -> "CONTRADICTS"
            "no" -> "UNRELATED"
            else -> null
        }

    /**
     * Step two, only for a paragraph that bears on the claim: does it say so outright, or does the
     * claim follow from it in one step, and which step. It starts as step one did, so the model
     * reads only the new question. Asked together, the two questions confused the small model.
     */
    fun how(claim: String, english: String?, p: Paragraph, verdict: Verdict): String = claimAndParagraph(claim, english, p) +
        "This paragraph shows the claim is ${if (verdict == Verdict.SUPPORTS) "true" else "false"}. Does it say so " +
        "outright (DIRECT), or does it follow in one clear step from facts or figures in the paragraph (INDIRECT)? " +
        "If INDIRECT, write a colon and one short sentence (at most 25 words) in Turkish naming that step, using " +
        "only facts and figures from the paragraph. Example: INDIRECT: Kişi başı satış 2017'de 120 litreyken 2020'de 95 litreye inmiş."

    const val HOW_GRAMMAR = "root ::= \"DIRECT\" | \"INDIRECT: \" reason\nreason ::= [^\\n<>]+"

    /**
     * Asked of a paragraph found to support the claim, with the paragraphs before and after it in
     * its document: does the document stand behind it, or set it out only to refute it ("Some say
     * …" followed by "This is not the case")? A refuted paragraph is not a finding.
     */
    fun stance(p: Paragraph, before: String?, after: String?): String =
        "Consecutive paragraphs from the document \"${p.docTitle.take(200)}\". Judge only the paragraph marked MIDDLE.\n\n" +
            (before?.let { "BEFORE:\n<<<\n${it.take(1200)}\n>>>\n\n" } ?: "") +
            "MIDDLE:\n<<<\n${p.text.take(2000)}\n>>>\n\n" +
            (after?.let { "AFTER:\n<<<\n${it.take(1200)}\n>>>\n\n" } ?: "") +
            "Does the document present what the MIDDLE paragraph says as true (OWN)? Or does it set it out as a myth, " +
            "a mistaken belief or a claim that the document itself, in the MIDDLE paragraph or the paragraphs around it, " +
            "rejects, refutes or corrects (REFUTED)? Answer with one word."

    const val STANCE_GRAMMAR = "root ::= \"OWN\" | \"REFUTED\""

    /** Saved in place of a verdict when the document refutes the paragraph; never a finding. */
    const val REFUTED = "REFUTED"

    /**
     * The model's answers (step one, then step two on the next line) as a judgement; null when the
     * paragraph does not bear on the claim.
     */
    fun parseJudgement(answer: String?, paragraph: String, claim: String = ""): Judgement? {
        val a = answer?.trim() ?: return null
        if (a.startsWith("UNRELATED")) return if (a.contains("\nANALOGY ")) parseAnalogy(a, paragraph, claim) else null
        val verdict = when {
            a.startsWith("SUPPORTS") -> Verdict.SUPPORTS
            a.startsWith("CONTRADICTS") -> Verdict.CONTRADICTS
            else -> return null
        }
        val indirect = Regex("\\bINDIRECT\\b").containsMatchIn(a)
        if (!indirect) return Judgement(verdict, false, null)
        val reason = a.substringAfter("INDIRECT:", "").trim().ifEmpty { null }
        val ok = reason != null && numbersIn(reason).all { it in numbersIn(paragraph) }
        return Judgement(verdict, true, if (ok) reason else null, reasonDropped = reason != null && !ok)
    }

    /**
     * Step four, kıyas: only when no paragraph bears on the claim outright, and only for the
     * paragraphs closest in meaning that step one called unrelated. It starts as step one did.
     */
    fun analogy(claim: String, english: String?, p: Paragraph): String = claimAndParagraph(claim, english, p) +
        "This paragraph does not show the claim itself. Reason by analogy (qiyas): does it describe a comparable " +
        "case, the same cause or mechanism in another country, time, group or product, whose outcome can be " +
        "carried over to the case in the claim? If not, answer NONE. If yes, first write SUPPORTS or CONTRADICTS " +
        "(what the analogy suggests for the claim), then four lines in Turkish: ASIL: the case in the paragraph " +
        "and its outcome; FER: the case in the claim; ILLET: the cause the two share; HUKUM: what follows for the " +
        "claim, worded as a likelihood (olabilir), not as a fact. Use only facts and figures from the paragraph " +
        "and the claim."

    const val ANALOGY_GRAMMAR = "root ::= \"NONE\" | dir \"\\nASIL: \" line \"\\nFER: \" line \"\\nILLET: \" line \"\\nHUKUM: \" line\n" +
        "dir ::= \"SUPPORTS\" | \"CONTRADICTS\"\n" +
        "line ::= [^\\n<>]+"

    /** How a checked paragraph is saved after step four: "UNRELATED", then the analogy or NOANALOGY. */
    fun withAnalogy(answer: String?): String =
        if (answer.isNullOrBlank() || answer.trim() == "NONE") "UNRELATED\nNOANALOGY" else "UNRELATED\nANALOGY ${answer.trim()}"

    private fun parseAnalogy(a: String, paragraph: String, claim: String): Judgement? {
        val body = a.substringAfter("\nANALOGY ", "").trim()
        val verdict = when {
            body.startsWith("SUPPORTS") -> Verdict.SUPPORTS
            body.startsWith("CONTRADICTS") -> Verdict.CONTRADICTS
            else -> return null
        }
        fun field(name: String) = Regex("(?m)^$name: (.+)$").find(body)?.groupValues?.get(1)?.trim()
        val an = Analogy(field("ASIL") ?: return null, field("FER") ?: return null, field("ILLET") ?: return null, field("HUKUM") ?: return null)
        // An analogy is all the model's own words: one figure that is in neither the paragraph nor the
        // claim, and the whole analogy is left out.
        val allowed = numbersIn(paragraph) + numbersIn(claim)
        if (!numbersIn(listOf(an.asil, an.fer, an.illet, an.hukum).joinToString(" ")).all { it in allowed }) return null
        return Judgement(verdict, indirect = true, reason = null, analogy = an)
    }

    /**
     * Figures in a text, compared by their digits only: "9,7", "9.7" and "97" are one figure. Small
     * numbers written as English words count too, since a reason may write "five years" as "5 yıl".
     */
    fun numbersIn(text: String): Set<String> {
        val digits = Regex("\\d+(?:[.,]\\d+)*").findAll(text).map { it.value.filter(Char::isDigit) }
        val words = Regex("[A-Za-z]+").findAll(text).mapNotNull { numberWords[it.value.lowercase()]?.toString() }
        return (digits + words).toSet()
    }

    private val numberWords = listOf(
        "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
        "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
    ).withIndex().associate { (i, w) -> w to i } +
        mapOf("thirty" to 30, "forty" to 40, "fifty" to 50, "sixty" to 60, "seventy" to 70, "eighty" to 80, "ninety" to 90, "hundred" to 100)

    const val SUGGEST_SYSTEM = "You help a researcher who searched a library of official reports and studies " +
        "for evidence about a claim."

    fun suggest(claim: String) = "Claim: $claim\n\nThe search found no paragraph that says outright whether this " +
        "claim is true. In one sentence in Turkish, suggest another direction for the research: a related, more " +
        "specific question, or another kind of measure or source to look at. Do not state any facts or figures."

    /** One line, and no digits: a direction to try, never a finding. */
    const val SUGGEST_GRAMMAR = "root ::= [^0-9\\n]+"
}
