package com.orbis.research

import android.content.Context

class Finding(val paragraph: Paragraph, val judgement: Judgement)

/**
 * One search, step by step, each step saved so an interrupted search goes on where it stopped:
 * 1. the meaning model picks the paragraphs closest in meaning to the claim (in any wording or
 *    language) within the chosen dates and sources;
 * 2. the language model puts the claim into English once (it judges English paragraphs better
 *    with it), then reads the paragraphs one by one and labels each; the words shown are always
 *    the paragraph as it was read from the document;
 * 3. if nothing bears on the claim outright, the model looks among the closest paragraphs for a
 *    comparable case to reason from by analogy (kıyas), shown apart from the evidence, and offers
 *    one line on where else to look.
 */
class Search(private val ctx: Context) {
    private val db = Db.get(ctx)

    /** Step 1; false (with a message saved) when the meaning model is missing or unusable. */
    suspend fun prepare(run: SearchRun): Boolean {
        val path = Models.embedderPath(ctx)
        if (path == null) { db.setRun(state = Db.RUN_FAILED, message = NO_EMBEDDER); return false }
        if (!Embedder.ensure(ctx, path)) { db.setRun(state = Db.RUN_FAILED, message = "Anlam modeli açılamadı; Model sekmesinden yeniden indirin."); return false }
        try {
            val q = Embedder.embed(Vectors.queryText(path, run.claim)) ?: run {
                db.setRun(state = Db.RUN_FAILED, message = "Yargı okunamadı."); return false
            }
            db.setItems(db.closest(q, Settings.candidates(ctx), run.range, run.sourceIds))
            db.setRun(prepared = true)
        } finally {
            Embedder.release()
        }
        return true
    }

    /**
     * Step 2 for one paragraph: the model's answers as saved (the verdict, and for a paragraph that
     * bears on the claim, on the next line, whether it says so outright and why not), or null if
     * the search was stopped.
     */
    suspend fun judge(claim: String, english: String?, paraId: Long): String? {
        val p = db.paragraph(paraId) ?: return "UNRELATED"
        val v = Llm.generate(Prompts.JUDGE_SYSTEM, Prompts.judge(claim, english, p), Prompts.JUDGE_GRAMMAR, maxTokens = 8)?.trim() ?: return null
        val verdict = when (v) { "SUPPORTS" -> Verdict.SUPPORTS; "CONTRADICTS" -> Verdict.CONTRADICTS; else -> return v }
        val how = Llm.generate(Prompts.JUDGE_SYSTEM, Prompts.how(claim, english, p, verdict), Prompts.HOW_GRAMMAR, maxTokens = 100)?.trim() ?: return null
        return "$v\n$how"
    }

    /**
     * Step four for one paragraph that step one called unrelated: the answer as saved, with the
     * model's kıyas if it found one, or null if the search was stopped.
     */
    suspend fun analogy(claim: String, english: String?, paraId: Long): String? {
        val p = db.paragraph(paraId) ?: return Prompts.withAnalogy(null)
        val a = Llm.generate(Prompts.JUDGE_SYSTEM, Prompts.analogy(claim, english, p), Prompts.ANALOGY_GRAMMAR, maxTokens = 180) ?: return null
        return Prompts.withAnalogy(a)
    }

    /** The claim in English, once per search; null if the search was stopped. */
    suspend fun translate(claim: String): String? =
        Llm.generate(Prompts.TRANSLATE_SYSTEM, Prompts.translate(claim), maxTokens = 60)?.let { Prompts.firstLine(it) ?: "" }

    /** Step 3. */
    suspend fun suggest(claim: String): String? =
        Llm.generate(Prompts.SUGGEST_SYSTEM, Prompts.suggest(claim), Prompts.SUGGEST_GRAMMAR, maxTokens = 70)?.trim()?.ifEmpty { null }

    /**
     * The paragraphs found so far: outright findings first, then indirect ones, then the model's
     * analogies; within each, supporting before contradicting.
     */
    fun findings(): List<Finding> {
        val claim = db.run()?.claim ?: ""
        return db.answers().mapNotNull { (id, answer) ->
            val p = db.paragraph(id) ?: return@mapNotNull null
            Prompts.parseJudgement(answer, p.text, claim)?.let { Finding(p, it) }
        }.sortedWith(compareBy<Finding>({ it.judgement.analogy != null }, { it.judgement.indirect }, { it.judgement.verdict.ordinal }))
    }

    companion object {
        /** How many of the closest unrelated paragraphs are tried for a kıyas. */
        const val ANALOGY_TRIES = 5
        const val NO_EMBEDDER = "Önce Model sekmesinden anlam modelini indirin."
    }
}
