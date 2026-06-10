package com.example.budgetapp.domain

data class ParsedBillRow(
    val name: String,
    val dayOfMonth: Int,
    val amountCents: Int,
    val error: String? = null
)

/**
 * Parses tab-delimited text into bill rows.
 * Each line format: name\tday\tamount
 * Blank/whitespace-only lines are skipped.
 * Amount may include leading '$' and thousands ',' separators.
 */
fun parseImportText(text: String): List<ParsedBillRow> {
    val results = mutableListOf<ParsedBillRow>()

    for (rawLine in text.split("\n")) {
        val line = rawLine.trimEnd()
        if (line.isBlank()) continue

        val parts = line.split("\t")
        val name = (parts.getOrNull(0) ?: "").trim()
        val dayRaw = (parts.getOrNull(1) ?: "").trim()
        val amountRaw = (parts.getOrNull(2) ?: "").trim()

        if (name.isEmpty() && dayRaw.isEmpty() && amountRaw.isEmpty()) continue

        val errors = mutableListOf<String>()

        if (name.isEmpty()) errors.add("name is required")

        val dayNum = dayRaw.toIntOrNull() ?: -1
        if (dayRaw.isEmpty() || dayNum < 1 || dayNum > 31) {
            errors.add("day must be 1–31")
        }

        val cleaned = amountRaw.replace(Regex("[$,\\s]"), "")
        val amountNum = cleaned.toDoubleOrNull() ?: Double.NaN
        if (amountRaw.isEmpty() || amountNum.isNaN() || amountNum <= 0) {
            errors.add("amount must be a positive number")
        }

        if (errors.isNotEmpty()) {
            results.add(
                ParsedBillRow(
                    name = name.ifEmpty { "(blank)" },
                    dayOfMonth = if (dayNum >= 0) dayNum else 0,
                    amountCents = 0,
                    error = errors.joinToString("; ")
                )
            )
        } else {
            results.add(
                ParsedBillRow(
                    name = name,
                    dayOfMonth = dayNum,
                    amountCents = (amountNum * 100).toLong().toInt()
                )
            )
        }
    }

    return results
}
