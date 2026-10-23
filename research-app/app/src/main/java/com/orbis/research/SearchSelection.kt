package com.orbis.research

/** Give every selected source a turn before spending the time budget on another source. */
object SearchSelection {
    fun <T> roundRobin(groups: List<List<T>>): Sequence<T> = sequence {
        val cursors = groups.map { it.iterator() }
        while (cursors.any { it.hasNext() }) {
            for (cursor in cursors) if (cursor.hasNext()) yield(cursor.next())
        }
    }

    /** Preserve score order, but reserve one document per source when the budget permits. */
    fun <T, K> diverse(scored: List<T>, limit: Int, source: (T) -> K): List<T> {
        if (limit <= 0) return emptyList()
        val selected = linkedSetOf<Int>()
        val sources = hashSetOf<K>()
        for ((i, item) in scored.withIndex()) {
            if (sources.add(source(item))) selected += i
            if (selected.size == limit) break
        }
        for (i in scored.indices) {
            if (selected.size >= limit) break
            selected += i
        }
        return selected.sorted().map { scored[it] }
    }
}
