package com.orbis.research

import java.time.LocalDate

/**
 * The dates a search covers, as yyyy-MM-dd; null means open on that side. A document dated only
 * by year or month counts when any day of it falls in the range. Documents whose date is unknown
 * count only when [includeUndated] is set.
 */
data class DateRange(val from: String? = null, val to: String? = null, val includeUndated: Boolean = true) {
    val isAll get() = from == null && to == null

    /** The same rule as [sqlCondition], for one date. */
    fun contains(date: String): Boolean {
        if (date.isEmpty()) return includeUndated
        val (start, end) = span(date)
        return (from == null || end >= from) && (to == null || start <= to)
    }

    /** An SQL condition on the date column [col], with its arguments. */
    fun sqlCondition(col: String): Pair<String, List<String>> {
        if (isAll) return (if (includeUndated) "1" else "$col <> ''") to emptyList()
        val start = "substr($col || '-01-01', 1, 10)"
        val end = "(CASE length($col) WHEN 4 THEN $col || '-12-31' WHEN 7 THEN $col || '-31' ELSE $col END)"
        val parts = ArrayList<String>()
        val args = ArrayList<String>()
        if (from != null) { parts += "$end >= ?"; args += from }
        if (to != null) { parts += "$start <= ?"; args += to }
        val dated = "($col <> '' AND ${parts.joinToString(" AND ")})"
        return (if (includeUndated) "($col = '' OR $dated)" else dated) to args
    }

    fun label(): String = when {
        isAll -> "Tüm tarihler"
        from != null && to != null -> "${tr(from)} – ${tr(to)}"
        from != null -> "${tr(from)} sonrası"
        else -> "${tr(to!!)} öncesi"
    }

    companion object {
        fun lastYears(n: Int, today: LocalDate = LocalDate.now(), includeUndated: Boolean = false) =
            DateRange(today.minusYears(n.toLong()).toString(), today.toString(), includeUndated)

        private fun span(date: String): Pair<String, String> = when (date.length) {
            4 -> "$date-01-01" to "$date-12-31"
            7 -> "$date-01" to "$date-31"
            else -> date to date
        }

        private fun tr(d: String) = d.split('-').reversed().joinToString(".")
    }
}
