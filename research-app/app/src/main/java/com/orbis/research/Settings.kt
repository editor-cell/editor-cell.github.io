package com.orbis.research

import android.content.Context

/** The owner's choices, kept on the phone. */
object Settings {
    private fun prefs(ctx: Context) = ctx.getSharedPreferences("settings", Context.MODE_PRIVATE)

    fun perSource(ctx: Context) = prefs(ctx).getInt("perSource", 50)
    fun setPerSource(ctx: Context, v: Int) = prefs(ctx).edit().putInt("perSource", v).apply()

    /** How many of the best-matching paragraphs the model reads for one claim. */
    fun candidates(ctx: Context) = prefs(ctx).getInt("candidates", 20)
    fun setCandidates(ctx: Context, v: Int) = prefs(ctx).edit().putInt("candidates", v).apply()

    fun daily(ctx: Context) = prefs(ctx).getBoolean("daily", false)
    fun setDaily(ctx: Context, v: Boolean) = prefs(ctx).edit().putBoolean("daily", v).apply()

    fun modelPath(ctx: Context): String? = prefs(ctx).getString("model", null)
    fun setModelPath(ctx: Context, v: String?) = prefs(ctx).edit().putString("model", v).apply()
}
