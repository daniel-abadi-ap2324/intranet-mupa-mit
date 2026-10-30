import { aliasedTable, and, count, countDistinct, desc, eq, gte, ilike, inArray, or, sql, type SQL } from 'drizzle-orm'

import { db, type Database } from '../../config/database.ts'
import { departments, forms, requestEvents, requests, users, type NewRequestRow, type RequestRow } from '../../database/schema/index.ts'
import { OPEN_STATUSES, RRHH_AREA_NAMES } from './requests.constants.ts'

export type RequestWithOwner = RequestRow & { ownerFirstName: string; ownerLastName: string | null; ownerEmail: string | null; ownerDepartment: string | null }
export type MyRequest = RequestRow & { unread: boolean }
export type RequestEventWithAuthor = { id: number; type: string; status: string | null; body: string | null; authorId: number | null; authorFirstName: string | null; authorLastName: string | null; createdAt: Date }

/**
 * Hay un cambio de estado o un mensaje del Gestor que la persona todavía no vio.
 * Las columnas de "requests" van escritas con su tabla: Drizzle las pondría sin
 * ella y dentro de la subconsulta "id" sería el del evento.
 */
const UNREAD = sql<boolean>`exists (
  select 1 from request_events e
  where e.request_id = "requests"."id"
    and e.type <> 'creada'
    and (e.author_id is null or e.author_id <> "requests"."user_id")
    and ("requests"."seen_by_owner_at" is null or e.created_at > "requests"."seen_by_owner_at")
)`

/** Evento del personal (no de quien la envió): una respuesta o un cambio de estado. */
const DEL_PERSONAL = sql`e.request_id = "requests"."id" and e.type <> 'creada' and (e.author_id is null or e.author_id <> "requests"."user_id")`
/** Cuándo respondió el personal por primera vez (null = todavía no). */
const PRIMERA_RESPUESTA = sql`(select min(e.created_at) from request_events e where ${DEL_PERSONAL})`
/** El último movimiento del personal o, si no hubo, cuándo llegó. */
const ULTIMO_MOVIMIENTO = sql`coalesce((select max(e.created_at) from request_events e where ${DEL_PERSONAL}), "requests"."created_at")`

export type RequestStats = {
  byStatus: { status: string; n: number }[]
  byForm: { area: string; form: string; total: number; open: number }[]
  overdue: number
  firstResponseHours: number | null
  resolvedSince: number
}
export type RecentRequestEvent = {
  id: number
  type: string
  status: string | null
  requestId: number
  folio: string | null
  formTitle: string
  authorId: number | null
  ownerId: number
  authorFirstName: string | null
  authorLastName: string | null
  createdAt: Date
}

const author = aliasedTable(users, 'author')

export class RequestsRepository {
  private readonly db: Database

  constructor(database: Database) {
    this.db = database
  }

  /** Crea la solicitud, su folio y el evento "creada", en una transacción. */
  async create(data: Omit<NewRequestRow, 'folio'>): Promise<RequestRow> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx.insert(requests).values(data).returning()
      const folio = 'SOL-' + row.createdAt.getFullYear() + '-' + String(row.id).padStart(6, '0')
      const [withFolio] = await tx.update(requests).set({ folio }).where(eq(requests.id, row.id)).returning()
      await tx.insert(requestEvents).values({ requestId: row.id, authorId: data.userId, type: 'creada', status: 'recibida' })
      return withFolio
    })
  }

  async countByUserSince(userId: number, since: Date): Promise<number> {
    const [row] = await this.db
      .select({ n: count() })
      .from(requests)
      .where(and(eq(requests.userId, userId), gte(requests.createdAt, since)))
    return row.n
  }

  async findByUser(userId: number): Promise<MyRequest[]> {
    const rows = await this.db
      .select({ request: requests, unread: UNREAD })
      .from(requests)
      .where(eq(requests.userId, userId))
      .orderBy(desc(requests.updatedAt), desc(requests.id))
    return rows.map((r) => ({ ...r.request, unread: !!r.unread }))
  }

  async countUnreadByUser(userId: number): Promise<number> {
    const [row] = await this.db
      .select({ n: count() })
      .from(requests)
      .where(and(eq(requests.userId, userId), UNREAD))
    return row.n
  }

  async countByStatus(status: string): Promise<number> {
    const [row] = await this.db.select({ n: count() }).from(requests).where(eq(requests.status, status))
    return row.n
  }

  /** Cifras del Centro de Gestión. `since`: desde cuándo cuentan los periodos; `overdueBefore`: sin movimiento del personal desde antes de esto = atrasada. */
  async stats(since: Date, overdueBefore: Date): Promise<RequestStats> {
    const byStatus = await this.db.select({ status: requests.status, n: count() }).from(requests).groupBy(requests.status)
    const byForm = await this.db
      .select({
        area: requests.formArea,
        form: requests.formTitle,
        total: count(),
        open: sql<number>`count(*) filter (where ${inArray(requests.status, OPEN_STATUSES)})`.mapWith(Number),
      })
      .from(requests)
      .groupBy(requests.formArea, requests.formTitle)
    const [overdue] = await this.db.select({ n: count() }).from(requests).where(this.overdue(overdueBefore))
    const [first] = await this.db
      .select({ hours: sql<number | null>`avg(extract(epoch from (${PRIMERA_RESPUESTA} - ${requests.createdAt}))) / 3600`.mapWith(Number) })
      .from(requests)
      .where(gte(requests.createdAt, since))
    const [resolved] = await this.db
      .select({ n: countDistinct(requestEvents.requestId) })
      .from(requestEvents)
      .where(and(eq(requestEvents.type, 'estado'), eq(requestEvents.status, 'resuelta'), gte(requestEvents.createdAt, since)))
    return { byStatus, byForm, overdue: overdue.n, firstResponseHours: first?.hours ?? null, resolvedSince: resolved.n }
  }

  /** Las atrasadas más viejas primero. */
  async findOverdue(overdueBefore: Date, limit: number): Promise<RequestWithOwner[]> {
    return this.selectWithOwner().where(this.overdue(overdueBefore)).orderBy(requests.createdAt, requests.id).limit(limit)
  }

  /** Cuándo llegó cada una desde esa fecha (para la serie por día). */
  async createdSince(since: Date): Promise<Date[]> {
    const rows = await this.db.select({ at: requests.createdAt }).from(requests).where(gte(requests.createdAt, since))
    return rows.map((r) => r.at)
  }

  /** Lo último que pasó en las solicitudes (llegadas, cambios de estado y respuestas). */
  async findRecentEvents(limit: number): Promise<RecentRequestEvent[]> {
    return this.db
      .select({
        id: requestEvents.id,
        type: requestEvents.type,
        status: requestEvents.status,
        requestId: requestEvents.requestId,
        folio: requests.folio,
        formTitle: requests.formTitle,
        authorId: requestEvents.authorId,
        ownerId: requests.userId,
        authorFirstName: author.firstName,
        authorLastName: author.lastName,
        createdAt: requestEvents.createdAt,
      })
      .from(requestEvents)
      .innerJoin(requests, eq(requests.id, requestEvents.requestId))
      .leftJoin(author, eq(author.id, requestEvents.authorId))
      .orderBy(desc(requestEvents.createdAt), desc(requestEvents.id))
      .limit(limit)
  }

  async findById(id: number): Promise<RequestWithOwner | undefined> {
    const [row] = await this.selectWithOwner().where(eq(requests.id, id)).limit(1)
    return row
  }

  /** Bandeja del Gestor: las más recientes primero. */
  async findMany(filter: { formSlug?: string; status?: string; area?: 'rrhh'; q?: string; overdueBefore?: Date }): Promise<RequestWithOwner[]> {
    const conditions: SQL[] = []
    if (filter.status) conditions.push(eq(requests.status, filter.status))
    if (filter.overdueBefore) conditions.push(this.overdue(filter.overdueBefore))
    if (filter.area === 'rrhh') conditions.push(inArray(sql`lower(${requests.formArea})`, RRHH_AREA_NAMES))
    if (filter.formSlug) conditions.push(eq(forms.slug, filter.formSlug))
    if (filter.q) {
      const like = '%' + filter.q.replace(/[\\%_]/g, (c) => '\\' + c) + '%'
      conditions.push(or(ilike(requests.folio, like), ilike(users.firstName, like), ilike(users.lastName, like), ilike(users.email, like), ilike(requests.formTitle, like))!)
    }
    return this.selectWithOwner()
      .innerJoin(forms, eq(forms.id, requests.formId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(requests.createdAt), desc(requests.id))
  }

  async findEvents(requestId: number): Promise<RequestEventWithAuthor[]> {
    return this.db
      .select({
        id: requestEvents.id,
        type: requestEvents.type,
        status: requestEvents.status,
        body: requestEvents.body,
        authorId: requestEvents.authorId,
        authorFirstName: author.firstName,
        authorLastName: author.lastName,
        createdAt: requestEvents.createdAt,
      })
      .from(requestEvents)
      .leftJoin(author, eq(author.id, requestEvents.authorId))
      .where(eq(requestEvents.requestId, requestId))
      .orderBy(requestEvents.createdAt, requestEvents.id)
  }

  /** Cambia el estado y lo anota en la línea de tiempo. */
  async updateStatus(id: number, status: string, authorId: number): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.update(requests).set({ status }).where(eq(requests.id, id))
      await tx.insert(requestEvents).values({ requestId: id, authorId, type: 'estado', status })
    })
  }

  /** Mensaje del Gestor; la solicitud queda como actualizada (sube en las listas). */
  async addMessage(id: number, authorId: number, body: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(requestEvents).values({ requestId: id, authorId, type: 'mensaje', body })
      await tx.update(requests).set({ updatedAt: new Date() }).where(eq(requests.id, id))
    })
  }

  async markSeen(id: number): Promise<void> {
    // Sin tocar updated_at: abrirla no es una novedad.
    await this.db.execute(sql`update ${requests} set seen_by_owner_at = now() where ${requests.id} = ${id}`)
  }

  /** Abierta y sin movimiento del personal desde antes de esa fecha. */
  private overdue(before: Date): SQL {
    return and(inArray(requests.status, OPEN_STATUSES), sql`${ULTIMO_MOVIMIENTO} < ${before.toISOString()}::timestamptz`)!
  }

  private selectWithOwner() {
    return this.db
      .select({
        id: requests.id,
        folio: requests.folio,
        formId: requests.formId,
        formTitle: requests.formTitle,
        formArea: requests.formArea,
        formSections: requests.formSections,
        userId: requests.userId,
        data: requests.data,
        summary: requests.summary,
        status: requests.status,
        seenByOwnerAt: requests.seenByOwnerAt,
        createdAt: requests.createdAt,
        updatedAt: requests.updatedAt,
        ownerFirstName: users.firstName,
        ownerLastName: users.lastName,
        ownerEmail: users.email,
        ownerDepartment: departments.name,
      })
      .from(requests)
      .innerJoin(users, eq(users.id, requests.userId))
      .leftJoin(departments, eq(departments.id, users.departmentId))
      .$dynamic()
  }
}

export const requestsRepository = new RequestsRepository(db)
