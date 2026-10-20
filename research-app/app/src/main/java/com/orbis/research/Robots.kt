package com.orbis.research

/** robots.txt rules for one site: the longest matching rule wins, Allow wins a tie. */
class Robots(private val rules: List<Pair<Boolean, Regex>>, private val lengths: List<Int>) {

    fun allows(path: String): Boolean {
        var best = -1
        var allow = true
        rules.forEachIndexed { i, (isAllow, re) ->
            if (re.containsMatchIn(path)) {
                val len = lengths[i]
                if (len > best || (len == best && isAllow)) { best = len; allow = isAllow }
            }
        }
        return allow
    }

    companion object {
        fun parse(text: String, agent: String): Robots {
            data class Group(val agents: MutableList<String> = mutableListOf(), val lines: MutableList<Pair<Boolean, String>> = mutableListOf())
            val groups = mutableListOf<Group>()
            var current: Group? = null
            var lastWasAgent = false
            for (raw in text.lines()) {
                val line = raw.substringBefore('#').trim()
                if (line.isEmpty()) continue
                val key = line.substringBefore(':').trim().lowercase()
                val value = line.substringAfter(':', "").trim()
                when (key) {
                    "user-agent" -> {
                        if (!lastWasAgent || current == null) { current = Group(); groups += current }
                        current.agents += value.lowercase()
                        lastWasAgent = true
                    }
                    "allow", "disallow" -> {
                        lastWasAgent = false
                        val g = current ?: continue
                        if (value.isEmpty()) continue
                        g.lines += (key == "allow") to value
                    }
                    else -> lastWasAgent = false
                }
            }
            val me = agent.lowercase()
            val chosen = groups.filter { g -> g.agents.any { it != "*" && me.contains(it) } }
                .ifEmpty { groups.filter { g -> g.agents.contains("*") } }
            val lines = chosen.flatMap { it.lines }
            return Robots(lines.map { (a, p) -> a to toRegex(p) }, lines.map { it.second.length })
        }

        fun sitemaps(text: String): List<String> = text.lines().mapNotNull { l ->
            val t = l.trim()
            if (t.lowercase().startsWith("sitemap:")) t.substringAfter(':').trim().ifEmpty { null } else null
        }.distinct()

        private fun toRegex(p: String): Regex {
            val end = p.endsWith("$")
            val body = (if (end) p.dropLast(1) else p).split("*").joinToString(".*") { Regex.escape(it) }
            return Regex("^" + body + if (end) "$" else "")
        }
    }
}
