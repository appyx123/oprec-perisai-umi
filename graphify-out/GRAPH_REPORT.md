# Graph Report - orec-perisai-umi  (2026-09-12)

## Corpus Check
- 68 files · ~379,543 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2105 nodes · 2452 edges · 182 communities (28 shown, 152 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `01a0cfab`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- worker-configuration.d.ts
- ServiceWorkerGlobalScope
- Event
- schema.ts
- index.ts
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
- index.astro
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
- reset-password.ts
- seed-documents.mjs
- aws4fetch

## God Nodes (most connected - your core abstractions)
1. `createDb()` - 50 edges
2. `drizzle-orm` - 27 edges
3. `Event` - 25 edges
4. `Console` - 21 edges
5. `astro` - 19 edges
6. `URLSearchParams` - 16 edges
7. `cagens` - 15 edges
8. `AuthUser` - 15 edges
9. `DurableObjectStorage` - 15 edges
10. `Container` - 15 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `createDb()`  [EXTRACTED]
  src/pages/api/admin/peminatan.ts → src/db/index.ts
- `GET()` --calls--> `createDb()`  [EXTRACTED]
  src/pages/api/user/profile.ts → src/db/index.ts
- `PUT()` --calls--> `createDb()`  [EXTRACTED]
  src/pages/api/user/profile.ts → src/db/index.ts
- `POST()` --calls--> `createDb()`  [EXTRACTED]
  src/pages/api/admin/peminatan.ts → src/db/index.ts
- `DELETE()` --calls--> `createDb()`  [EXTRACTED]
  src/pages/api/admin/qna.ts → src/db/index.ts

## Import Cycles
- None detected.

## Communities (182 total, 152 thin omitted)

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
Cohesion: 0.08
Nodes (28): Admin, BerkasCagen, berkasCagensRelations, Cagen, CagenDocument, cagenDocumentsRelations, cagensRelations, DocumentType (+20 more)

### Community 4 - "index.ts"
Cohesion: 0.20
Nodes (7): drizzle-orm, Db, DbEnvConfig, berkasCagens, cagens, systemSettings, AuthUser

### Community 5 - "auth.ts"
Cohesion: 0.12
Nodes (24): resolveDbCredentials(), admins, AUTH_COOKIE_NAME, clearAuthCookie(), generateNomorRegistrasi(), getAuthToken(), getJwtSecretKey(), JwtSecretOrEnv (+16 more)

### Community 6 - "createDb"
Cohesion: 0.20
Nodes (14): createDb(), PublicQna, DELETE(), GET(), PATCH(), GET(), GET(), POST() (+6 more)

### Community 7 - "astro"
Cohesion: 0.16
Nodes (21): astro, cagenDocuments, documentTypes, Peminatan, createPresignedGetUrl(), createPresignedPutUrl(), deleteS3Object(), extractS3Key() (+13 more)

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

### Community 64 - "index.astro"
Cohesion: 0.50
Nodes (7): timelineEvents, applyDiff(), pad(), setActive(), setBeforeStart(), setClosed(), update()

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

### Community 178 - "reset-password.ts"
Cohesion: 0.22
Nodes (6): bcryptjs, client, seed(), verifyPasswordResetJwt(), POST(), prerender

## Knowledge Gaps
- **1040 isolated node(s):** `name`, `type`, `version`, `node`, `dev` (+1035 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1749 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **152 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `WorkerEntrypoint` connect `WorkerEntrypoint` to `worker-configuration.d.ts`, `index.ts`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Why does `Performance` connect `Performance` to `worker-configuration.d.ts`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **Why does `URL` connect `URL` to `worker-configuration.d.ts`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **What connects `name`, `type`, `version` to the rest of the system?**
  _1040 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `worker-configuration.d.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0022471910112359553 - nodes in this community are weakly interconnected._
- **Should `ServiceWorkerGlobalScope` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._
- **Should `Event` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._