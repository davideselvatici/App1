# App1

Ledger groups bank-statement expenses in an installable, offline app. See
[LEGGIMI.txt](LEGGIMI.txt) for installation, backups, and updates.

## Language

The app opens in Italian. Tap **Impostazioni** (Settings) in the navigation to
switch between Italian and English; the choice is saved on the device and kept
when you delete all data. Interface texts live in the `<script id="i18n">` block
of `index.html`: add every new text in both languages.

## Free online classification

Unknown merchants can be looked up with Tavily Basic Search and classified by a
free language model of your choice. This replaces the paid Claude feature.

1. Create a [Tavily API key](https://app.tavily.com/home) on its free plan.
2. Create a key for the model you want to use:

   | Model | Free plan | Where to get the key |
   | --- | --- | --- |
   | **Google Gemini** (preselected) | free input and output tokens every day, the largest free quota of the three | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
   | Cerebras | free trial of roughly one million tokens per day | [cloud.cerebras.ai](https://cloud.cerebras.ai) |
   | Groq | the smallest free quota, roughly 200,000 tokens per day | [console.groq.com/keys](https://console.groq.com/keys) |

3. Enter both keys in **Ricerca online**, pick the model, and tap **Attiva gratis**.

Gemini, Cerebras and Groq all speak the same OpenAI-compatible chat API, so
changing model only changes which key you paste and which endpoint the app calls.
If one free quota runs out, switch to another in the same card. A key saved by an
earlier version keeps working: it is moved to the new slot on first load.

[Tavily's free plan](https://www.tavily.com/pricing) includes 1,000 credits per
month without a credit card; each merchant lookup uses one
[Basic Search credit](https://docs.tavily.com/documentation/api-credits).
Every model listed above has a free plan with its own daily quota; Groq's
[minute and daily quotas](https://console.groq.com/docs/rate-limits) are the
tightest, which is why Gemini is the default. Keep every account on its free
plan without adding a payment method or upgrading: exhausted quotas stop online
classification until they reset, without paid fallback.

Only unknown transactions use these services. Tavily receives a cleaned merchant
name and location for unknown card merchants; the chosen model receives the
cleaned unknown transaction's name, description, amount, and search snippets.
IBANs and account identifiers are excluded. See the data policy of the service
you pick, for example [Groq's](https://console.groq.com/docs/your-data) or
[Google's](https://ai.google.dev/gemini-api/terms). All keys stay in this
browser's local storage and are excluded from backups. Cached categories
and manual corrections are reused for later imports.

Internet access is needed for this optional online feature. Statement imports,
local categorization, backups, and the rest of the installed app still work
offline.

## Checks

Run `bun test` for automated checks. No live API keys are included; using the
online feature requires your own keys.
