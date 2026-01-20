## **✅ Canonical User Context Field Guide for RAG System**

This document standardizes how user profile metadata is modeled and interpreted across the RAG pipeline.

Each user context is defined across five structured dimensions:

1. **User Metadata Fields**

2. **Community Affinity: `communityExperience` and `tags`**

3. **Language Behavior & Inference**

4. **Access Rights & Membership Level**

These definitions support intelligent retrieval filtering, dynamic prompting, and multilingual response generation.

---

### **1\. User Metadata Fields**

Each user is modeled as a flat key-value dictionary. Fields are used for pre-filtering (e.g., retrieval), prompt injection (e.g., language, brand affinity), and content formatting (e.g., upsell logic).

| Field | Description |
| ----- | ----- |
| `platform` | One of: `entwickler.de`, `devm.io`, or `devmio.nl`. Determines language fallback and communities. |
| `accessTier` | One of: `none`, `basic`, `fullstack`, `elevate`. Defines access level across content types. |
| `communityExperience` | Optional. Predefined community cluster. Overrides manual tag logic if present. |
| `tags` | Optional. Up to four user-selected technology tags. Used if `communityExperience` is absent. |
| `languagePreference` | Inferred before prompting using a lightweight language detection step based on the query string. Not stored in the user profile, but passed as part of the runtime user context. Used to determine generation language and formatting. |
| `addOnDiscountAmount` | Numeric value of the user's discount on add-ons. |
| `addOnDiscountType` | `fixed` (applied in EUR or USD, depending on platform) or `percent` (applied to add-on cost). |

---

### **2\. Community Affinity: `communityExperience` and `tags`**

The `communityExperience` and `tags` fields together express a user's thematic orientation and topical interest within the platform.

They are **mutually exclusive sources of affinity metadata**, and **only one is set per user at a time**:

* If a user has selected a **predefined community experience**, the `communityExperience` field is populated and `tags` is ignored.

* If no community is chosen, users may define up to **four technology tags**, which are stored in the `tags` field.

#### **Purpose and Effect**

This affinity metadata shapes how the system interprets otherwise broad or ambiguous queries. The retrieval pipeline and prompt logic should **condition responses to align with the user’s implied interest**:

* If the query is vague or cross-domain (e.g., “AI”, “testing”, or “Spring”), use the `communityExperience` or `tags` as **contextual signals** to disambiguate.

* If the query is well-formed but open-ended, this metadata may help determine **relevant examples, tone, or content emphasis**.

#### **Examples**

| User Profile Configuration | Query | Resulting Affinity-Based Adjustment |
| ----- | ----- | ----- |
| platform: devmio.nlcommunityExperience: FrontMania | "AI" | Response focuses on AI in the context of frontend tooling |
| platform: devm.iotags: Java, Kubernetes | "testing" | Prefer examples or citations from Java/K8s stack |
| platform: entwickler.detags: PHP | "Spring" | Response likely requests clarification or avoids misrouting to Java |

#### **Design Notes**

* Community experiences are curated bundles aligned with magazine or conferences brands (e.g., “JAX \+ Java Magazin” or “DevOpsCon”). Use Name, Topics and Description in table below.

* Tags are manually selected by users from a controlled vocabulary (\~50 options).

* Both community experiences and tags indicate area of interest and community affiliation and should be used as user preferences when generating responses. Please use all information to extract community differences where there may be overlap

* Adjacent topics to community experiences or tags which are not explicitly mentioned should still be considered as part of user preference, e.g. although “[node.js](http://node.js)” is not explicitly mentioned as a topic of iJS \+ JavaScript & Angular Days community topic it is strongly relevant.

* Both fields support filtering and prompt-level adaptation; they are **never used together**.

#### **Available Community Experiences by Platform**

Depending on the value of the  `platform` only the community experiences valid for that platform may be selected in `communityExperience`.

##### **If field value equals `entwickler.de` (German platform)**

| Community Experience | Topics | Description |
| ----- | ----- | ----- |
| JAX \+ Java Magazin | Java, Spring, Microservices, Go | Java Journeys — Code, Architektur & Innovation |
| BASTA\! \+ windows.developer | .NET, Azure, UX, Visual Studio | Starke Kompetenz  in C\#, .NET, Cloud und Web |
| DevOpsCon | DevOps, Kubernetes, Platform Engineering,  Continuous Delivery | Re-think IT: Better, faster, more reliable |
| iJS \+ JavaScript & Angular Days | JavaScript, Angular, React, TypeScript | Die Welt von JavaScript, TypeScript, Angular, React & Co. |
| MLCon | Machine Learning, Python | The AI revolution is here: Be a pioneer\! |
| IPC \+ PHPmag | PHP, Datenbanken, Security, Webdesign | Know-How für PHP Professionals |
| Software Architecture Summit \+ CAMP | Software-Architektur,DDD, Microservices, Security  | Strategie Kompetenz für nachhaltige Business-Systeme |
| API Conference \+ MAD Summit | API, DDD, Microservices, Software Architetur  | Bestes Wissen für API-Design, Modularisierung & Domain-Driven Design.  |
| Serverless Architecture Conference | Serverless, Cloud, API, DevOps | Serverless — Die Zukunft der Cloud-Native-Entwicklung.  |
| IT Security Summit \+ IT Security Camp | Security, DevOps, API, Testing | Effektive Security, nachhaltig und stark |
| Webinale | UX, Webdesign, SEO, Online Marketing | Von UX bis Code – erfolgreiche Produkte im Web.  |
| EKON | Delphi, Datenbanken, Security | Klassisch innovativ: Delphi-Technologie  |

---

##### **If field value equals `devm.io` (English platform)**

| Community Experience | Tags (optional defaults) | Description |
| ----- | ----- | ----- |
| DevOpsCon | DevOps, Kubernetes, Platform Engineering,  Continuous Delivery | Re-think IT: better, faster, more reliable |
| iJS | JavaScript, Angular, React, TypeScript | Step into the world of JavaScript, TypeScript, React & more |
| MLCon | Machine Learning, Python | Be part of the AI revolution |
| IPC | PHP, Web Design, Databases, Security | Know-how for PHP professionals |
| JAX | Java, API, Software Architecture, Microservices | Explore Java, API design, and Software Architecture |
| API Conference | API, Microservices, DDD | Best knowledge for API design, modularization & domain-driven design |

---

##### **If field value equals `devmio.nl` (Dutch platform)**

| Community Experience | Tags (optional defaults) | Description |
| ----- | ----- | ----- |
| NLJUG Java Community | Java, Software Architecture, Kotlin, Soft Skills, | Java journeys – code, architecture & innovation |
| SDN Dotnet & Microsoft | .NET, Azure, AI, C\# | Expertise in C\#, .NET, cloud and more |
| Frontmania | JavaScript, Angular, TypeScript, Frontend | Modern frontend development |
| DevOpsCon | DevOps, Kubernetes, Platform Engineering, CI/CD | Re-think IT: Better, faster, more reliable |
| MLCon | Machine Learning, AI, Python, Data Science | The AI Revolution is here – be a pioneer\! |

---

#### **Custom Tag Vocabulary**

If `tags` are used instead of a `communityExperience`, the user may select **up to four** from the following list:

`.NET`, `API`, `ASP.NET`, `AWS`, `Agile`, `Android`, `Angular`, `Azure`, `Blockchain`, `C#`, `Cloud`, `Container`, `Continuous Delivery`, `DDD`, `Datenbanken`, `Delphi`, `DevOps`, `Docker`, `Eclipse`, `Go`, `IoT`, `Java`, `JavaScript`, `Kubernetes`, `Machine Learning`, `Microservices`, `Mobile`, `Node.js`, `Online Marketing`, `PHP`, `Python`, `React`, `Recht & Netzkultur`, `Ruby`, `Rust`, `SEO`, `Security`, `Serverless`, `SharePoint`, `Software-Architektur`, `Spring`, `Swift`, `Testing`, `TypeScript`, `UX`, `Visual Studio`, `Vue.js`, `Webdesign`, `Windows`, `WordPress`, `Xamarin`, `iOS`

---

### **3\. Language Behavior & Inference**

The system dynamically infers the user's preferred language by analyzing the input query before generation. This inferred value is passed as the `languagePreference` field in the user context metadata and determines the response language (e.g., tone, grammar, formatting).

If the query is ambiguous or language cannot be reliably determined (e.g., single-word inputs like `"Java"`), the system overrides the `languagePreference` using platform-based defaults:

| Platform | Fallback Language |
| :---- | :---- |
| `entwickler.de` | German |
| `devm.io` | English |
| `devmio.nl` | Dutch |

* This logic determines the **response generation language only** — it does **not** affect retrieval filtering or scoring.

* Do **not** exclude any chunks based on the `language` fieldin chunk metadata. Relevant content in any language may still be valuable, especially in multilingual contexts.

---

### **4\. Access Rights & Membership Level**

### The `accessTier` field defines the user’s membership level and is used by the assistant to:

* ### Prioritize content the user can immediately access.

* ### Enhance the response experience with tailored messaging.

* ### Promote relevant add-ons when appropriate.

### The assistant’s role is not only to answer queries, but also to guide discovery of content offerings — surfacing valuable material the user may benefit from, even if they currently lack access.

#### **4.1 Content Prioritization by Access Tier**

### If multiple relevant chunks are retrieved (e.g., one from a READ article and one from a FSLE session), the assistant should:

* ### Prefer results the user can access under their `accessTier`.

* ### Still summarize or reference inaccessible results, but wrap them in a tone-appropriate content preview, highlighting their value and availability as an add-on.

### **4.2 Access Tier Logic and Marketing Messaging**

### The `accessTier` field does not directly unlock RHEINGOLD, CAMP, or FLEX\_CAMP content. These content types are always treated as paid add-ons, regardless of the user's tier. The assistant must understand this logic and guide the user accordingly.

#### **Tier-Based Access Summary**

| Tier | Has Access To | Notes |
| ----- | ----- | ----- |
| `none` | Selected free READ articles (public only) | Cannot access any premium or member content. Limited RAG use allowance. |
| `basic` | All READ content | No access to video formats. Can purchase add-ons separately. Limited RAG use allowance. |
| `fullstack` | READ, FSLE, TUTORIAL | Unlimited RAG use. Includes 6-month access to RHEINGOLD session recordings if and only if access was purchased separately. Can receive add on discounts by applying Fullstack ID (found in account admin’s settings) when purchasing the add on. |
| `elevate` | Same as `fullstack` | Unlimited RAG use. Includes 6-month access to RHEINGOLD session recordings if and only if access was purchased separately. Access to internal procurement dashboard. All booking auto-discounted. |

#### **Add-on Eligibility**

### Add-on content (RHEINGOLD, CAMP, FLEX\_CAMP) is never granted automatically by `accessTier`.

* ### Users must **purchase access separately**, or receive it through promotion or institutional license.

* ### Add-on **discounts apply only if the chunk’s `date` is in the future**.

    * ### If the `date` is in the past, the assistant must not suggest purchasing the add-on.

    * ### Instead, the assistant can offer general information or mention that the session has passed and suggest purchasing a ticket for a future edition.

#### **Assistant Messaging Strategy**

### When a **chunk comes from an add-on, and `access` is set to `restricted`**  in chunk header meta data, then tailor the response based on the user’s tier and the chunk’s date:

| Tier | Response Behavior |
| ----- | ----- |
| `none` | Reference the add-on as valuable expert content; suggest exploring it via platform event listings. Mention that they additionally receive discounts and recordings as Fullstack members. |
| `basic` | Highlight that user has full article access, and offer the add-on as a next step. Mention that they additionally receive discounts and recordings as Fullstack members. |
| `fullstack` | Mention available discount (via Fullstack ID) and 6 months recording; invite user to apply it during checkout. |
| `elevate` | Recommend using the internal dashboard for booking; note that discount is automatically applied. |

### 💡 **If the add-on chunk is past-dated**, skip purchase messaging and instead:

* ### Treat the chunk as informative context.

* ### Optionally suggest similar upcoming content based on user interest.

### When a **chunk DOES NOT come from an add-on**, then **Tier-Based Access Summary** table above dictates the value of the access field, unless public or promotional content. The pre-generated `accessMessage` field in chunk header fully determines what access note or call-to-action should be displayed for this chunk. Downstream systems must display this message verbatim and avoid recomputing access rules

#### **Tone and Delivery**

* ### **Always be helpful, not salesy**. Responses should feel like tailored guidance.

* ### **Incorporate value framing**: “This session was part of the MLCon workshop — as a Fullstack user, you’re eligible for a discount if you’d like to attend the next one.”

### **4.3 Redemption & Example**

### 

### **Redemption Logic**

### How the user’s add-on discount is applied depends on their `accessTier`:

* ### **Fullstack Users**    Discounts must be manually redeemed by entering their Fullstack ID (visible in user profile) during event checkout.

* ### **Elevate Users**    Discounts are automatically applied when booking through the platform’s internal procurement dashboard.    An additional 3% is applied when payment is made using a prepaid account.


#### **Example: Personalized CTA Logic**

### Suppose the assistant retrieves a document from a **CAMP** workshop titled *"Modular DevOps Patterns"* with a `date` of *November 20, 2025*.  The user has:

* ### `accessTier`: `fullstack`

* ### `addOnDiscountAmount`: `150`

* ### `addOnDiscountType`: `fixed`

* ### `platform`: `entwickler.de`

### The assistant might append a contextual CTA like:

### ✨ *This content is part of the “Modular DevOps Patterns” workshop at DevOps Camp Berlin (Nov 2025). As a Fullstack member, you’re eligible for a €150 discount when booking your seat. Simply use your Fullstack ID at checkout.*

### Or, if the user has `accessTier = elevate`:

### ✨ *This content comes from “Modular DevOps Patterns” — a premium CAMP workshop in November 2025\. As an Elevate user, you can request participation right here on [entwickler.de](http://entwickler.de) by clicking the request icon. Your full discount is automatically applied.*

### If the `date` of the document is **in the past**, the assistant instead offers value positioning:

### *This workshop session was part of DevOps Camp Berlin 2025\. While booking is no longer available, you might enjoy related live training coming soon — check our upcoming events.*

### 

