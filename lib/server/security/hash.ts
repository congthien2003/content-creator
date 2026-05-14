import { createHmac } from 'crypto'

export function canonicalJson(value: unknown) {
  return JSON.stringify(sortJson(value))
}

export function createPayloadHash(input: {
  userId: string
  workflowId: string
  stepKey: string
  attemptNumber: number
  payload: unknown
}) {
  const secret = process.env.APP_HASH_SECRET
  if (!secret) throw new Error('APP_HASH_SECRET is required for workflow payload hashing.')
  const message = [input.userId, input.workflowId, input.stepKey, String(input.attemptNumber), canonicalJson(input.payload)].join(':')
  return createHmac('sha256', secret).update(message).digest('hex')
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson)
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortJson((value as Record<string, unknown>)[key])
        return acc
      }, {})
  }
  return value
}
