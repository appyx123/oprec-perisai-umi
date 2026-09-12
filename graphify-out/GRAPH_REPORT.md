# Graph Report - orec-perisai-umi  (2026-09-13)

## Corpus Check
- 76 files · ~390,942 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2130 nodes · 2517 edges · 181 communities (27 shown, 152 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d89b53f8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- worker-configuration.d.ts
- ServiceWorkerGlobalScope
- Event
- schema.ts
- drizzle-orm
- auth.ts
- createDb
- astro
- dashboard/settings.astro
- Console
- TransformStream
- URL
- package.json
- URLSearchParams
- dependencies
- 3. Database Schema (Drizzle / Turso)
- Container
- DurableObjectStorage
- Element
- Headers
- SubtleCrypto
- Blob
- Body
- FormData
- URLPattern
- DurableObjectState
- WorkerEntrypoint
- scripts
- StreamError
- Flagship
- R2ObjectBody
- AgentMemoryProfile
- ByteLengthQueuingStrategy
- WritableStream
- DurableObject
- DurableObjectTransaction
- ReadableStream
- Socket
- WritableStreamDefaultWriter
- AiSearchInstance
- DurableObjectNamespace
- R2Bucket
- SqlStorageCursor
- Vectorize
- WorkflowInstance
- Ai
- AiSearchNamespace
- ReadableStreamBYOBReader
- VectorizeIndex
- @sentry/astro
- AiSearchItem
- AiSearchItems
- Artifacts
- ArtifactsRepo
- D1Database
- D1PreparedStatement
- ImageHandle
- KVNamespace
- ReadableByteStreamController
- ReadableStreamDefaultReader
- Span
- TextDecoder
- devDependencies
- tsconfig.json
- index.ts
- env.d.ts
- AiGateway
- Comment
- Disposable
- DurableObjectFacets
- ForwardableEmailMessage
- HostedImagesBinding
- HTMLRewriter
- HTMLRewriterDocumentContentHandlers
- ReadableStreamBYOBRequest
- ReadableStreamDefaultController
- StreamScopedCaptions
- StreamVideoHandle
- StreamWatermarks
- SyncKvStorage
- Table
- Text
- TextEncoder
- Tracing
- TransformStreamDefaultController
- Workflow
- seed-peminatan.mjs
- AbortController
- AiSearchJob
- AiSearchJobs
- AutoRAG
- Cache
- Crypto
- D1DatabaseSession
- EndTag
- ExecProcess
- ExecutionContext
- HTMLRewriterElementContentHandlers
- ImagesBinding
- ImageTransformationResult
- ImageTransformer
- MediaTransformationResult
- Module
- Performance
- Queue
- R2MultipartUpload
- StreamBinding
- StreamScopedDownloads
- WebSocketRequestResponsePair
- WorkflowEntrypoint
- Astro Starter Kit: Minimal
- AgentMemoryNamespace
- BasicImageTransformations
- BrowserRun
- ColoLocalActorNamespace
- DOMException
- DurableObjectId
- Global
- HelloWorldBinding
- HyperdriveDynamicApi
- MediaTransformer
- Memory
- Message
- MessageBatch
- NodeStyleServer
- PipelineTransformationEntrypoint
- RequestInitCfPropertiesVaryHeader
- SqlStorage
- ToMarkdownService
- WorkerLoader
- WorkerStub
- WorkflowStep
- WritableStreamDefaultController
- migrate-criteria.mjs
- AnalyticsEngineDataset
- __BaseEnv_Env
- CacheContext
- CacheStorage
- CloudflareAccessContext
- CompileError
- DispatchNamespace
- DocumentEnd
- EventListenerObject
- Hyperdrive
- IncomingRequestCfPropertiesBotManagement
- Instance
- JsonWebKey
- MediaBinding
- MediaTransformationGenerator
- MessageChannel
- Navigator
- NonRetryableError
- Pipeline
- ProcessEnv
- R2Checksums
- RateLimit
- ResponseFunctionToolCall
- RpcTarget
- RuntimeError
- ScheduledController
- Scheduler
- SecretsStoreSecret
- SendEmail
- StreamVideos
- TraceItemFetchEventInfoRequest
- UnsafeTraceMetrics
- WebSearch
- __DURABLE_OBJECT_BRAND
- onRequest
- __RPC_STUB_BRAND
- __RPC_TARGET_BRAND
- __WORKER_ENTRYPOINT_BRAND
- __WORKFLOW_ENTRYPOINT_BRAND
- AGENTS.md
- CLAUDE.md
- rules/graphify.md
- workflows/graphify.md
- seed.mjs
- seed-documents.mjs

## God Nodes (most connected - your core abstractions)
1. `createDb()` - 58 edges
2. `drizzle-orm` - 30 edges
3. `Event` - 25 edges
4. `astro` - 21 edges
5. `Console` - 21 edges
6. `cagens` - 16 edges
7. `AuthUser` - 16 edges
8. `URLSearchParams` - 16 edges
9. `DurableObjectStorage` - 15 edges
10. `Container` - 15 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `createDb()`  [EXTRACTED]
  src/pages/api/admin/peminatan.ts → src/db/index.ts
- `GET()` --calls--> `createDb()`  [EXTRACTED]
  src/pages/api/admin/search-applicants.ts → src/db/index.ts
- `GET()` --calls--> `createDb()`  [EXTRACTED]
  src/pages/api/user/profile.ts → src/db/index.ts
- `PUT()` --calls--> `createDb()`  [EXTRACTED]
  src/pages/api/user/profile.ts → src/db/index.ts
- `DELETE()` --calls--> `createDb()`  [EXTRACTED]
  src/pages/api/admin/documents.ts → src/db/index.ts

## Import Cycles
- None detected.

## Communities (181 total, 152 thin omitted)

### Community 0 - "worker-configuration.d.ts"
Cohesion: 0.00
Nodes (886): RFC-2253, RFC-3339, RFC-5246, RFC-9440, AgentMemoryGetSummaryOptions, AgentMemoryGetSummaryResponse, AgentMemoryIncomingMemory, AgentMemoryIngestOptions (+878 more)

### Community 1 - "ServiceWorkerGlobalScope"
Cohesion: 0.04
Nodes (7): AbortSignal, EventSource, EventTarget, MessagePort, ServiceWorkerGlobalScope, WebSocket, WorkerGlobalScope

### Community 2 - "Event"
Cohesion: 0.04
Nodes (12): CloseEvent, CustomEvent, EmailEvent, ErrorEvent, Event, ExtendableEvent, FetchEvent, MessageEvent (+4 more)

### Community 3 - "schema.ts"
Cohesion: 0.06
Nodes (34): Admin, BerkasCagen, berkasCagens, berkasCagensRelations, Cagen, CagenDocument, cagenDocumentsRelations, cagens (+26 more)

### Community 4 - "drizzle-orm"
Cohesion: 0.12
Nodes (17): drizzle-orm, cagenDocuments, documentTypes, Peminatan, systemSettings, timelineEvents, AuthUser, closeModal() (+9 more)

### Community 5 - "auth.ts"
Cohesion: 0.14
Nodes (19): admins, AUTH_COOKIE_NAME, clearAuthCookie(), getAuthToken(), getJwtSecretKey(), JwtSecretOrEnv, PasswordResetPayload, resolveJwtSecret() (+11 more)

### Community 6 - "createDb"
Cohesion: 0.13
Nodes (19): createDb(), PublicQna, DELETE(), generateSlug(), GET(), POST(), prerender, PUT() (+11 more)

### Community 7 - "astro"
Cohesion: 0.16
Nodes (19): astro, aws4fetch, createPresignedGetUrl(), createPresignedPutUrl(), deleteS3Object(), extractS3Key(), getAwsClient(), getS3Config() (+11 more)

### Community 8 - "dashboard/settings.astro"
Cohesion: 0.09
Nodes (21): ANGKATAN_OPTIONS, FAKULTAS_PRODI_MAP, PEMINATAN_OPTIONS, GET(), prerender, PUT(), fakultasList, profileAlertError (+13 more)

### Community 10 - "TransformStream"
Cohesion: 0.10
Nodes (7): CompressionStream, DecompressionStream, FixedLengthStream, IdentityTransformStream, TextDecoderStream, TextEncoderStream, TransformStream

### Community 12 - "package.json"
Cohesion: 0.11
Nodes (17): allowScripts, esbuild, engines, node, name, type, version, @astrojs/check (+9 more)

### Community 14 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, astro, @astrojs/cloudflare, aws4fetch, bcryptjs, browser-image-compression, cropperjs, drizzle-orm (+7 more)

### Community 15 - "3. Database Schema (Drizzle / Turso)"
Cohesion: 0.05
Nodes (40): 1.1 Astro / Cloudflare configuration, 1.2 Environment variables (expected), 1.3 Layout of application code, 1. Tech Stack Summary, 2.1 Public / shared UI, 2.2 Cagen dashboard UI (auth required), 2.3 Admin UI (auth required), 2.4 API tree (+32 more)

### Community 22 - "Body"
Cohesion: 0.15
Nodes (3): Body, Request, Response

### Community 27 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, astro, build, db:generate, db:migrate, db:push, db:seed, db:studio (+3 more)

### Community 28 - "StreamError"
Cohesion: 0.18
Nodes (11): AlreadyUploadedError, BadRequestError, ForbiddenError, InternalError, InvalidURLError, MaxFileSizeError, NotFoundError, QuotaReachedError (+3 more)

### Community 32 - "ByteLengthQueuingStrategy"
Cohesion: 0.22
Nodes (3): ByteLengthQueuingStrategy, CountQueuingStrategy, QueuingStrategy

### Community 49 - "@sentry/astro"
Cohesion: 0.33
Nodes (3): @astrojs/cloudflare, @sentry/astro, @tailwindcss/vite

### Community 62 - "devDependencies"
Cohesion: 0.40
Nodes (5): devDependencies, @astrojs/check, drizzle-kit, @types/bcryptjs, typescript

### Community 63 - "tsconfig.json"
Cohesion: 0.40
Nodes (4): astro/tsconfigs/strict, exclude, extends, include

### Community 64 - "index.ts"
Cohesion: 0.17
Nodes (14): bcryptjs, Db, DbEnvConfig, resolveDbCredentials(), passwordResets, generateNomorRegistrasi(), signPasswordResetJwt(), AppEnv (+6 more)

### Community 65 - "env.d.ts"
Cohesion: 0.40
Nodes (4): App, Cloudflare, Env, Locals

### Community 68 - "Disposable"
Cohesion: 0.40
Nodes (3): Disposable, HyperdriveDynamic, StubBase

### Community 110 - "Astro Starter Kit: Minimal"
Cohesion: 0.40
Nodes (4): Astro Starter Kit: Minimal, 🧞 Commands, 🚀 Project Structure, 👀 Want to learn more?

### Community 112 - "BasicImageTransformations"
Cohesion: 0.67
Nodes (3): BasicImageTransformations, RequestInitCfPropertiesImage, RequestInitCfPropertiesImageDraw

### Community 126 - "RequestInitCfPropertiesVaryHeader"
Cohesion: 0.67
Nodes (3): RequestInitCfPropertiesVaryAcceptHeader, RequestInitCfPropertiesVaryAcceptLanguageHeader, RequestInitCfPropertiesVaryHeader

### Community 133 - "migrate-criteria.mjs"
Cohesion: 0.40
Nodes (3): @libsql/client, client, defaultCriteria

## Knowledge Gaps
- **1045 isolated node(s):** `name`, `type`, `version`, `node`, `dev` (+1040 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1757 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **152 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `WorkerEntrypoint` connect `WorkerEntrypoint` to `worker-configuration.d.ts`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Why does `Performance` connect `Performance` to `worker-configuration.d.ts`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Why does `Console` connect `Console` to `worker-configuration.d.ts`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **What connects `name`, `type`, `version` to the rest of the system?**
  _1045 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `worker-configuration.d.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0022471910112359553 - nodes in this community are weakly interconnected._
- **Should `ServiceWorkerGlobalScope` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._
- **Should `Event` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._