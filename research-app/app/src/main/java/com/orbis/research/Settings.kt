package com.orbis.research

import android.content.Context

/** The owner's choices, kept on the phone. */
object Settings {
    private fun prefs(ctx: Context) = ctx.getSharedPreferences("settings", Context.MODE_PRIVATE)

    fun perSource(ctx: Context) = prefs(ctx).getInt("perSource", 50)
    fun setPerSource(ctx: Context, v: Int) = prefs(ctx).edit().putInt("perSource", v).apply()

    /** How many of the best-matching paragraphs the model reads for one claim. */
    fun candidates(ctx: Context) = prefs(ctx).getInt("candidates", 60).coerceIn(10, 60)
    fun setCandidates(ctx: Context, v: Int) = prefs(ctx).edit().putInt("candidates", v.coerceIn(10, 60)).apply()

    fun daily(ctx: Context) = prefs(ctx).getBoolean("daily", false)
    fun setDaily(ctx: Context, v: Boolean) = prefs(ctx).edit().putBoolean("daily", v).apply()

    fun modelPath(ctx: Context): String? = prefs(ctx).getString("model", null)
    fun setModelPath(ctx: Context, v: String?) = prefs(ctx).edit().putString("model", v).apply()

    /** The meaning model the stored paragraph vectors were made with. */
    fun vectorModel(ctx: Context): String? = prefs(ctx).getString("vectorModel", null)
    fun setVectorModel(ctx: Context, v: String) = prefs(ctx).edit().putString("vectorModel", v).apply()

    fun embedderId(ctx: Context): String? = prefs(ctx).getString("embedder", null)
    fun setEmbedderId(ctx: Context, v: String) = prefs(ctx).edit().putString("embedder", v).apply()

    /** Whether a search first looks at the sources' newest document lists and opens the closest ones. */
    fun live(ctx: Context) = prefs(ctx).getBoolean("live", true)
    fun setLive(ctx: Context, v: Boolean) = prefs(ctx).edit().putBoolean("live", v).apply()

    /** How many documents a search opens live. */
    fun liveRead(ctx: Context) = prefs(ctx).getInt("liveRead", 24).coerceIn(0, 24)
    fun setLiveRead(ctx: Context, v: Int) = prefs(ctx).edit().putInt("liveRead", v.coerceIn(0, 24)).apply()

    /** When a source's document list was last fetched live (milliseconds), 0 if never. */
    fun discovered(ctx: Context, sourceId: Long) = prefs(ctx).getLong("disc_$sourceId", 0L)
    fun setDiscovered(ctx: Context, sourceId: Long, at: Long) = prefs(ctx).edit().putLong("disc_$sourceId", at).apply()
}
