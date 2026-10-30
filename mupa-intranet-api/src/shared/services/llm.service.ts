import { z, type ZodType } from 'zod'

import { env, type LlmConfig } from '../../config/env.ts'
import { DomainError } from '../errors/domain-error.ts'

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

const UNAVAILABLE = 'El asistente no está disponible en este momento. Intenta de nuevo en unos minutos.'
const UPSTREAM_ERROR = 'El asistente tuvo un problema al responder. Intenta de nuevo.'

// Lo que interesa de la respuesta de /v1/chat/completions.
const completionSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }), finish_reason: z.string().nullable().optional() })).min(1),
})

/**
 * Cliente del servidor de inferencia de la Alcaldía (vLLM, API compatible con OpenAI).
 * Pide salida JSON con un schema (`response_format: json_schema`: el servidor restringe
 * la generación a ese schema) y la vuelve a validar con Zod al recibirla.
 * No registra el contenido de los mensajes ni de las respuestas: solo estados y códigos.
 */
export class LlmService {
  private readonly config: LlmConfig

  constructor(config: LlmConfig) {
    this.config = config
  }

  async chatJson<T>(options: { messages: ChatMessage[]; schema: ZodType<T>; schemaName: string; maxTokens: number; temperature: number }): Promise<T> {
    const { $schema: _, ...jsonSchema } = z.toJSONSchema(options.schema) as Record<string, unknown>
    let res: Response
    try {
      res = await fetch(this.config.url + '/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          ...(this.config.model ? { model: this.config.model } : {}),
          messages: options.messages,
          max_tokens: options.maxTokens,
          temperature: options.temperature,
          response_format: { type: 'json_schema', json_schema: { name: options.schemaName, schema: jsonSchema, strict: true } },
        }),
        redirect: 'manual',
        signal: AbortSignal.timeout(this.config.timeoutMs),
      })
    } catch (err) {
      console.error(`El servidor de inferencia no respondió: ${(err as Error).name}`)
      throw new DomainError(UNAVAILABLE, 503, 'LLM_UNAVAILABLE')
    }

    if (!res.ok) {
      console.error(`El servidor de inferencia respondió HTTP ${res.status}`)
      throw new DomainError(UPSTREAM_ERROR, 502, 'LLM_ERROR')
    }

    const completion = completionSchema.safeParse(await res.json().catch(() => null))
    if (!completion.success) {
      console.error('El servidor de inferencia respondió algo que no es una chat completion. ¿LLM_URL apunta al servicio correcto?')
      throw new DomainError(UPSTREAM_ERROR, 502, 'LLM_ERROR')
    }
    const { message, finish_reason } = completion.data.choices[0]

    let parsed: unknown
    try {
      parsed = JSON.parse(message.content ?? '')
    } catch {
      // "length" = se cortó por max_tokens y el JSON quedó a medias.
      console.error(`La respuesta del modelo no es JSON válido (finish_reason: ${finish_reason ?? 'desconocido'}).`)
      throw new DomainError(UPSTREAM_ERROR, 502, 'LLM_ERROR')
    }
    const result = options.schema.safeParse(parsed)
    if (!result.success) {
      console.error(`La respuesta del modelo no tiene la forma esperada (${options.schemaName}).`)
      throw new DomainError(UPSTREAM_ERROR, 502, 'LLM_ERROR')
    }
    return result.data
  }
}

export const llmService = env.llm ? new LlmService(env.llm) : null
