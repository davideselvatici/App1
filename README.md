# App1

Dove Spendo groups bank-statement expenses in an installable, offline app. See
[LEGGIMI.txt](LEGGIMI.txt) for installation, backups, and updates.

## Free online classification

Unknown merchants can be looked up with Tavily Basic Search and classified by
Groq using `openai/gpt-oss-20b`. This replaces the paid Claude feature.

1. Create a personal [Groq API key](https://console.groq.com/keys) on its free plan.
2. Create a [Tavily API key](https://app.tavily.com/home) on its free plan.
3. Enter both keys in **Ricerca online** and tap **Attiva gratis**.

[Tavily's free plan](https://www.tavily.com/pricing) includes 1,000 credits per
month without a credit card; each merchant lookup uses one
[Basic Search credit](https://docs.tavily.com/documentation/api-credits).
[Groq's free plan](https://console.groq.com/docs/billing-faqs) provides free model
requests with [minute and daily quotas](https://console.groq.com/docs/rate-limits).
Keep both accounts on their free plans without adding a payment method or
upgrading: exhausted quotas stop online classification until they reset,
without paid fallback.

Only unknown transactions use these services. Tavily receives a cleaned merchant
name and location for unknown card merchants; Groq receives the cleaned unknown
transaction's name, description, amount, and search snippets. IBANs and account
identifiers are excluded. See [Groq's data policy](https://console.groq.com/docs/your-data)
for service-side data handling. Both keys stay in this browser's local storage
and are excluded from backups. Cached categories
and manual corrections are reused for later imports.

Internet access is needed for this optional online feature. Statement imports,
local categorization, backups, and the rest of the installed app still work
offline.

## Checks

Run `bun test` for automated checks. No live API keys are included; using the
online feature requires your own keys.
