<div align="center">

# TraceX

### See what is trending, who is driving it, where it spreads, and how people feel about it.

**AI-powered social intelligence and information-flow analytics for X and Telegram**

<br/>

![Smart India Hackathon 2026](https://img.shields.io/badge/Smart%20India%20Hackathon-2026-5B4B9A?style=for-the-badge)
![Problem Statement](https://img.shields.io/badge/PS-26152-7B6BC0?style=for-the-badge)
![Team](https://img.shields.io/badge/Team-Perplexus-3E8E6B?style=for-the-badge)
![Category](https://img.shields.io/badge/Category-Software-C0475A?style=for-the-badge)

![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)
![Streamlit](https://img.shields.io/badge/Streamlit-FF4B4B?style=flat-square&logo=streamlit&logoColor=white)
![Kafka](https://img.shields.io/badge/Apache%20Kafka-231F20?style=flat-square&logo=apachekafka&logoColor=white)
![Airflow](https://img.shields.io/badge/Airflow-017CEE?style=flat-square&logo=apacheairflow&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Neo4j](https://img.shields.io/badge/Neo4j-4581C3?style=flat-square&logo=neo4j&logoColor=white)
![scikit-learn](https://img.shields.io/badge/scikit--learn-F7931E?style=flat-square&logo=scikitlearn&logoColor=white)
![Plotly](https://img.shields.io/badge/Plotly-3F4F75?style=flat-square&logo=plotly&logoColor=white)

<br/>


</div>

<br/>

## Table of contents

- [The problem](#the-problem)
- [The solution](#the-solution)
- [Product tour](#product-tour)
- [How it works](#how-it-works)
- [Why TraceX is different](#why-tracex-is-different)
- [Tech stack](#tech-stack)
- [Privacy by design](#privacy-by-design)
- [Getting started](#getting-started)
- [Roadmap](#roadmap)
- [Team](#team)

<br/>

## The problem

Social-media data is scattered across platforms and tools. Analysts can see that something is trending, but not clearly **who is driving it**, **where it is spreading**, or **how audience sentiment is shifting**.

<div align="center">

| **70%** | **6+** | **60%** |
|:---:|:---:|:---:|
| of critical online narratives are detected only *after* they trend | separate tools often needed for a complete analysis | of analyst time is spent collecting and preparing data |

</div>

By the time a coordinated or misleading narrative is visible, it has usually already spread.

<br/>

## The solution

**TraceX** unifies X and Telegram into a single, time-aware intelligence dashboard. It collects conversations continuously, stores a historical timeline, and runs a full AI analysis stack on top of it.

<div align="center">

| WHAT is trending? | WHO is driving it? | WHERE is it spreading? | HOW is sentiment changing? |
|:---:|:---:|:---:|:---:|
| Trend and topic detection | PageRank influence analysis | Community and propagation graph | Sentiment and emotion over time |

</div>

<br/>

## Product tour

TraceX is organised into eight modules, reachable from one sidebar. Every screen shares the same filters: platform, time window, and language.

### 01 · Mission Control

One operating view across X and Telegram: posts tracked, active narratives, average sentiment, high-risk alerts, a live alert feed, and pipeline health.

<img width="807" height="440" alt="Image" src="https://github.com/user-attachments/assets/fa4e9c3f-c293-4f1b-b309-ece9ff065157" />

<br/>

### 02 · Trend Explorer

Emerging narratives are ranked by growth against a historical baseline, each with a **risk score**. A filterable table tracks keywords and hashtags by volume, 24-hour change, platform split, and risk.

<img width="807" height="436" alt="Image" src="https://github.com/user-attachments/assets/66d65b61-4615-4ccb-a162-80b3bc263c98" />

<br/>

### 03 · Sentiment & Emotion

Positive, neutral and negative composition over 30 days, with automatic **shift-event detection** and a six-class emotion model: support, opposition, anxiety, anger, joy and curiosity.

<img width="810" height="436" alt="Image" src="https://github.com/user-attachments/assets/8a431afb-5a36-4588-aa17-44bcf5e09ea8" />

<br/>

### 04 · Demographics & Audience Cohorts

Who is in the conversation, at cohort level only: state-level geography, age brackets, interests, and a language split that treats **Hinglish as a first-class category**. Every figure is aggregated with k-anonymity of at least 50.

<img width="811" height="437" alt="Image" src="https://github.com/user-attachments/assets/554b5a63-52d5-472f-a53a-faae4f0f8ffe" />

<br/>

### 05 · Network & Influence

Replies, mentions and reposts become a directed graph. **PageRank** sizes influence, **Louvain** colours communities, and a propagation trace highlights how a narrative cascades between groups. Bot-linked nodes are flagged directly on the graph.

<img width="955" height="474" alt="Image" src="https://github.com/user-attachments/assets/4dd37635-3458-4c98-a260-d3e58b0e001a" />

<br/>

### 06 · Bot Detection & Misinformation Radar

Accounts are scored from 0 to 1 using behavioural signals: posting frequency, account age, duplicate content and timing patterns. A second tab tracks claim-level misinformation, correlating risk with bot activity and spread pattern.

<img width="789" height="376" alt="Image" src="https://github.com/user-attachments/assets/cc807c5e-bf09-4f36-8c18-21e76f771eb2" />

<br/>

### 07 · Alerts & Reports

Every detection lands in one triage log with severity, type and status filters. Analysts can export CSV logs and generate intelligence briefs that bundle KPIs, findings, bot clusters and the misinformation dossier.

<img width="954" height="470" alt="Image" src="https://github.com/user-attachments/assets/f6190a44-67f0-464f-9c43-6c96c11f521f" />

> **Note:** figures in the screenshots come from the prototype's demonstration dataset.

<br/>

## How it works

```mermaid
flowchart LR
    A["X API"] --> C
    B["Telegram API"] --> C
    C["Ingestion<br/>clean, normalize,<br/>timestamp"] --> D[("Historical timeline<br/>PostgreSQL + Neo4j")]
    D --> E

    subgraph E["AI Intelligence Engine"]
        direction TB
        E1["Sentiment & emotion"]
        E2["Demographic profiling"]
        E3["Trend detection"]
        E4["Network & influence"]
        E5["Bot detection"]
        E6["Misinformation detection"]
    end

    E --> F["Intelligence fusion"]
    F --> G["Analyst dashboard<br/>real-time alerts & reports"]
```

| Module | Approach | Output |
|---|---|---|
| **Demographics** | spaCy NER for explicit traits (location, language); Gemma 4 for implicit traits (age bracket, interests); aggregated and anonymized | Audience cohorts |
| **Sentiment & emotion** | TF-IDF with keyword frequency; emotion classes; tracked over time | Net sentiment, emotion mix, shift events |
| **Trend detection** | TF-IDF, topic modelling, comparison with historical baseline | Emerging narratives, abnormal spikes |
| **Bot detection** | Post frequency, account age, duplicates, timing patterns | Bot probability score (0 to 1) |
| **Network analysis** | Replies, mentions, reposts as a graph; PageRank and community detection | Influencers and propagation paths |
| **Misinformation** | Claim extraction, fact-check API cross-check, correlation with bot score and spread | Misinformation risk score |
| **Fusion & dashboard** | Combines trends, sentiment, audience, network and risk | Dashboard, alerts, reports |

<br/>

## Why TraceX is different

| | Sprinklr | Brandwatch | **TraceX** |
|---|---|---|---|
| **Cost** | Enterprise-only, high pricing | $6K to 15K+ per year | **Free or low-cost** |
| **Focus** | Customer experience suite | Market research | **Governance, disaster response, public sentiment** |
| **Platforms** | Broad, paid tiers | Broad, paid tiers | **X, Telegram and more, unified** |
| **Network mapping** | Basic share-of-voice | Surface-level influencers | **PageRank, communities, propagation paths** |
| **Misinformation** | Not a core feature | Not a core feature | **Built in** |
| **Bot activity** | Limited or add-on | Limited or add-on | **Native bot probability scoring** |

**In short:**

- **Unified** content, audience, trends and networks in one platform
- **Information-flow focus** that tracks propagation, not just volume
- **Multilingual** analysis built for India's code-mixed content
- **Early detection** with time-aware baselines
- **Integrity native**: bots and misinformation are core modules, not add-ons

<br/>

## Tech stack

| Layer | Technology |
|---|---|
| Language | Python |
| Data sources | X API, Telegram API |
| NLP & AI | spaCy, Gemma 4 |
| Storage | PostgreSQL (time-series), Neo4j (graph) |
| Streaming & orchestration | Apache Kafka, Apache Airflow |
| Analytics | scikit-learn, NetworkX |
| Visualization | Plotly, Streamlit |

<br/>

## Privacy by design

Social-media monitoring raises real concerns about surveillance and transparency. TraceX is built to answer them.

- **Aggregate only.** Audience insight is reported at cohort level with k-anonymity of at least 50.
- **No individual profiling.** The system analyses narratives, communities and networks.
- **PII suppressed at ingest**, with data minimization and access controls.
- **Confidence scores** accompany model outputs so analysts can judge reliability.

<br/>

## Getting started

> Adjust these steps to match your repository layout.

```bash
# 1. Clone the repository
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>

# 2. Create a virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt
python -m spacy download en_core_web_sm

# 4. Add your API credentials
cp .env.example .env             # then fill in X and Telegram keys

# 5. Launch the dashboard
streamlit run app.py
```

<br/>

## Roadmap

- [x] Unified X + Telegram ingestion and historical timeline
- [x] Sentiment, emotion, demographics, trends, network, bot and misinformation modules
- [x] Real-time alerts and exportable analyst reports
- [ ] Additional platforms: Instagram, Facebook, Reddit, YouTube
- [ ] Deeper multilingual fine-tuning for regional languages and slang
- [ ] Custom alert rules and scheduled briefings

<br/>

## Team

**Team Perplexus** · Smart India Hackathon 2026 · Problem Statement 26152

| Name | Role | GitHub |
|---|---|---|
| _Your name_ | _Role_ | [@username](https://github.com/username) |
| _Member 2_ | _Role_ | [@username](https://github.com/username) |

<br/>

<div align="center">

**Built for a safer, more informed India.**

</div>
